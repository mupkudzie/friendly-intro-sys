import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, AlertTriangle, CheckCircle, XCircle, Volume2, Timer, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getReliablePosition } from '@/lib/geolocation';

interface LocationReverificationProps {
  taskId: string;
  taskLocation: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  isTaskActive: boolean;
  locationTypeIsFarm: boolean;
  supervisorId?: string;
  taskStartTime?: string | null;
  verifyTime1Min?: number | null;
  verifyTime2Min?: number | null;
  verifyTime1At?: string | null;
  verifyTime2At?: string | null;
  onVerificationFailed?: () => void;
}

const MAX_VERIFICATIONS = 2;
const TIMEOUT_DURATION = 2 * 60 * 1000; // 2 minutes
// First popup fires shortly after the task starts (1–3 min in).
const FIRST_MIN_MS = 1 * 60 * 1000;
const FIRST_MAX_MS = 3 * 60 * 1000;
// Second popup fires later, randomly during the task (8–20 min after the first).
const SECOND_MIN_MS = 8 * 60 * 1000;
const SECOND_MAX_MS = 20 * 60 * 1000;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function playNotificationSound() {
  // 1) If the worker picked a custom sound from their music, play that.
  try {
    const customUrl = localStorage.getItem('reverify_sound_url');
    if (customUrl) {
      const audio = new Audio(customUrl);
      audio.volume = 1.0;
      const p = audio.play();
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch(() => fallbackBeep());
      }
      return;
    }
  } catch (e) {
    console.warn('Custom sound failed, falling back:', e);
  }
  fallbackBeep();
}

function fallbackBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playTone(880, now, 0.3);
    playTone(1100, now + 0.35, 0.3);
    playTone(880, now + 0.7, 0.3);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

export function LocationReverification({
  taskId,
  taskLocation,
  isTaskActive,
  locationTypeIsFarm,
  supervisorId,
  taskStartTime,
  verifyTime1Min,
  verifyTime2Min,
  verifyTime1At,
  verifyTime2At,
  onVerificationFailed,
}: LocationReverificationProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  const [verificationsCompleted, setVerificationsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [nextCheckAt, setNextCheckAt] = useState<number | null>(null); // epoch ms
  const [secondsToNext, setSecondsToNext] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const nextTickRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic scheduled count based entirely on supervisor configurations
  const scheduledCount = [
    verifyTime1At || (verifyTime1Min != null && verifyTime1Min > 0 && taskStartTime),
    verifyTime2At || (verifyTime2Min != null && verifyTime2Min > 0 && taskStartTime)
  ].filter(Boolean).length;

  // Initialize verificationsCompleted from the database to survive navigation/refresh
  useEffect(() => {
    let active = true;
    setLoading(true);
    const fetchExistingVerifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;

        console.log(`LocationReverification: Fetching verification logs for taskId=${taskId}, userId=${user.id}`);
        const { data, error } = await supabase
          .from('verification_logs')
          .select('verification_number')
          .eq('task_id', taskId)
          .eq('user_id', user.id);

        if (!error && data && active) {
          setVerificationsCompleted(data.length);
          console.log(`LocationReverification: Successfully loaded ${data.length} verification logs from DB.`);
        } else if (error) {
          console.error('LocationReverification: Error loading logs:', error);
        }
      } catch (err) {
        console.error('LocationReverification: Exception fetching existing verifications:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchExistingVerifications();
    return () => {
      active = false;
    };
  }, [taskId]);

  // Persist verification event to DB
  const logVerification = useCallback(async (params: {
    status: 'success' | 'failed' | 'missed';
    verificationNumber: number;
    coords?: { latitude: number; longitude: number; accuracy?: number };
    distance?: number | null;
    notes?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('verification_logs').insert({
        task_id: taskId,
        user_id: user.id,
        verification_number: params.verificationNumber,
        status: params.status,
        latitude: params.coords?.latitude ?? null,
        longitude: params.coords?.longitude ?? null,
        accuracy: params.coords?.accuracy ?? null,
        distance_from_target: params.distance ?? null,
        expected_latitude: taskLocation.latitude,
        expected_longitude: taskLocation.longitude,
        expected_radius: taskLocation.radius,
        notes: params.notes ?? null,
        responded_at: params.status === 'missed' ? null : new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to log verification:', e);
    }
  }, [taskId, taskLocation]);

  const notifySupervisor = useCallback(async (reason: string) => {
    try {
      const { data: taskData } = await supabase
        .from('tasks')
        .select('assigned_by, title')
        .eq('id', taskId)
        .single();

      if (taskData?.assigned_by) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: workerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user?.id || '')
          .single();

        await supabase.from('notifications').insert({
          recipient_id: taskData.assigned_by,
          sender_id: user?.id || null,
          type: 'location_warning',
          title: 'Location Verification Warning',
          message: `${workerProfile?.full_name || 'A worker'} ${reason} for task "${taskData.title}".`,
        });
      }
    } catch (e) {
      console.error('Failed to notify supervisor:', e);
    }
  }, [taskId]);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (nextTickRef.current) clearInterval(nextTickRef.current);
  }, []);

  const scheduleNextCheck = useCallback(() => {
    clearAllTimers();
    if (!isTaskActive || !locationTypeIsFarm) {
      setNextCheckAt(null);
      setSecondsToNext(null);
      return;
    }

    // Dynamic scheduling: list only verification schedules configured by the supervisor
    const scheduled = [];
    if (verifyTime1At && !isNaN(new Date(verifyTime1At).getTime())) {
      scheduled.push({ number: 1, fireAt: new Date(verifyTime1At).getTime() });
    } else if (verifyTime1Min != null && verifyTime1Min > 0 && taskStartTime && !isNaN(new Date(taskStartTime).getTime())) {
      scheduled.push({ number: 1, fireAt: new Date(taskStartTime).getTime() + verifyTime1Min * 60 * 1000 });
    }

    if (verifyTime2At && !isNaN(new Date(verifyTime2At).getTime())) {
      scheduled.push({ number: 2, fireAt: new Date(verifyTime2At).getTime() });
    } else if (verifyTime2Min != null && verifyTime2Min > 0 && taskStartTime && !isNaN(new Date(taskStartTime).getTime())) {
      scheduled.push({ number: 2, fireAt: new Date(taskStartTime).getTime() + verifyTime2Min * 60 * 1000 });
    }

    // Sort chronologically and filter out any invalid/NaN timestamps
    const validScheduled = scheduled.filter(item => item && !isNaN(item.fireAt));
    validScheduled.sort((a, b) => a.fireAt - b.fireAt);

    if (validScheduled.length === 0) {
      console.log('LocationReverification: No supervisor verification set.');
      setNextCheckAt(null);
      setSecondsToNext(null);
      return;
    }

    if (verificationsCompleted >= validScheduled.length) {
      console.log('LocationReverification: All scheduled verifications completed.', {
        verificationsCompleted,
        count: validScheduled.length
      });
      setNextCheckAt(null);
      setSecondsToNext(null);
      return;
    }

    const nextVerification = validScheduled[verificationsCompleted];
    let fireAt = nextVerification.fireAt;
    const verificationNum = nextVerification.number;

    try {
      console.log(`LocationReverification: Next scheduled verification #${verificationNum} at:`, new Date(fireAt).toISOString());
    } catch (e) {
      console.log(`LocationReverification: Next scheduled verification #${verificationNum} at raw time:`, fireAt);
    }

    if (fireAt <= Date.now()) {
      console.log('LocationReverification: Scheduled time passed. Firing instantly (2s settle).');
      fireAt = Date.now() + 2000;
    }

    setNextCheckAt(fireAt);
    const initialSeconds = Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));
    setSecondsToNext(initialSeconds);

    const triggerPopup = () => {
      if (!isTaskActive) return;
      console.log(`LocationReverification: TRIGGERING FULLSCREEN POPUP FOR VERIFICATION #${verificationNum}`);
      playNotificationSound();
      setShowDialog(true);
      setResult(null);
      setTimeRemaining(120);
      setSecondsToNext(0);

      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        console.log(`LocationReverification: Timeout reached for verification #${verificationNum}`);
        setShowDialog(false);
        setVerificationsCompleted(prev => prev + 1);
        logVerification({
          status: 'missed',
          verificationNumber: verificationNum,
          notes: 'Worker did not respond within 2 minutes',
        });
        notifySupervisor('did not respond to location verification within 2 minutes');
        toast({
          title: 'Verification Missed',
          description: 'You did not verify your location in time. Supervisor has been notified.',
          variant: 'destructive',
        });
      }, TIMEOUT_DURATION);
    };

    nextTickRef.current = setInterval(() => {
      const remaining = Math.ceil((fireAt - Date.now()) / 1000);
      setSecondsToNext(Math.max(0, remaining));

      if (Date.now() >= fireAt) {
        if (nextTickRef.current) clearInterval(nextTickRef.current);
        triggerPopup();
      }
    }, 1000);
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, clearAllTimers, notifySupervisor, logVerification, verifyTime1Min, verifyTime2Min, verifyTime1At, verifyTime2At, taskStartTime]);

  useEffect(() => {
    if (!loading && isTaskActive && locationTypeIsFarm && verificationsCompleted < scheduledCount) {
      scheduleNextCheck();
    }
    return () => clearAllTimers();
  }, [loading, isTaskActive, locationTypeIsFarm, verificationsCompleted, scheduledCount, scheduleNextCheck, clearAllTimers]);

  // Vibrate mobile device and play alert sound every 15 seconds while popup is active
  useEffect(() => {
    if (!showDialog || result === 'success') return;

    const runAlert = () => {
      playNotificationSound();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 100, 300]);
      }
    };

    runAlert();
    const interval = setInterval(runAlert, 15000);
    return () => clearInterval(interval);
  }, [showDialog, result]);

  // Catch missed verification times immediately on mobile wakeup or tab visbility return
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTaskActive && nextCheckAt && !showDialog && verificationsCompleted < scheduledCount) {
        if (Date.now() >= nextCheckAt) {
          console.log('LocationReverification: Catching missed timer on tab wake!');
          scheduleNextCheck();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTaskActive, nextCheckAt, showDialog, verificationsCompleted, scheduledCount, scheduleNextCheck]);

  const handleVerify = async () => {
    setChecking(true);
    const verificationNumber = verificationsCompleted + 1;
    try {
      const position = await getReliablePosition();

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );

      const isWithin = distance <= Math.max(taskLocation.radius, 50) + Math.min(position.coords.accuracy ?? 0, 100);
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      if (isWithin) {
        setResult('success');
        clearAllTimers();
        await logVerification({
          status: 'success',
          verificationNumber,
          coords,
          distance,
        });
        const newCount = verificationsCompleted + 1;
        setVerificationsCompleted(newCount);
        toast({
          title: 'Location Verified ✓',
          description: `Verification ${newCount}/${scheduledCount} complete. Keep up the good work!`,
        });
        setTimeout(() => {
          setShowDialog(false);
          if (newCount < scheduledCount) {
            scheduleNextCheck();
          }
        }, 2000);
      } else {
        setResult('failed');
        await logVerification({
          status: 'failed',
          verificationNumber,
          coords,
          distance,
          notes: `Worker was ${Math.round(distance)}m away from work site`,
        });
        toast({
          title: 'Location Verification Failed',
          description: `You are ${Math.round(distance)}m away from the work site.`,
          variant: 'destructive',
        });
        notifySupervisor(`failed location verification (${Math.round(distance)}m away)`);
        if (onVerificationFailed) onVerificationFailed();
      }
    } catch (error) {
      setResult('failed');
      await logVerification({
        status: 'failed',
        verificationNumber,
        notes: 'GPS error - failed to obtain location',
      });
      toast({
        title: 'GPS Error',
        description: 'GPS is unavailable. Turn on location services, allow precise location, then try again.',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isTaskActive || !locationTypeIsFarm || scheduledCount === 0) return null;

  if (showDialog) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 pointer-events-auto select-none">
        <div className="w-full max-w-sm rounded-3xl border border-orange-500/30 bg-slate-900 text-white shadow-2xl p-6 space-y-5 animate-scale-up">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-400">
              <Volume2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-heading tracking-tight leading-none text-slate-100">
                Location Re-verification
              </h3>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">
                Check {verificationsCompleted + 1} of {scheduledCount}
              </p>
            </div>
          </div>

          <Card className="p-4 border-orange-500/20 bg-orange-500/10 rounded-2xl">
            <div className="flex items-start gap-3 text-orange-200">
              <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-orange-300">Confirm you are still at the farm location</p>
                <p className="text-[10px] text-orange-200/70 mt-1 leading-relaxed">
                  You are required to verify your location within 2 minutes. You cannot exit this screen until completed.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center gap-2.5 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/50">
            <Timer className="h-5 w-5 text-slate-400" />
            <span className={`text-2xl font-mono font-black ${timeRemaining <= 30 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
              {formatTime(timeRemaining)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">remaining</span>
          </div>

          {result === 'success' && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-slide-in">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold">Location verified! Proceeding...</span>
            </div>
          )}

          {result === 'failed' && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 animate-slide-in">
              <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
              <span className="text-xs font-semibold">Not at work site! Supervisor notified.</span>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={checking || result === 'success'}
            className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/95 text-white border-0 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {checking ? 'Checking GPS Location...' : 'Verify My Location'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
