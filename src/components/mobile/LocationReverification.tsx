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
          // Count only entries that are completed (success, failed, or missed)
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
    if (!isTaskActive || !locationTypeIsFarm || verificationsCompleted >= MAX_VERIFICATIONS) {
      console.log('LocationReverification: Scheduler bypassed/stopped.', { isTaskActive, locationTypeIsFarm, verificationsCompleted });
      setNextCheckAt(null);
      setSecondsToNext(null);
      return;
    }

    const isFirst = verificationsCompleted === 0;
    const configuredAtStr = isFirst ? verifyTime1At : verifyTime2At;
    let fireAt: number;

    console.log('LocationReverification: scheduleNextCheck started.', {
      verificationsCompleted,
      verifyTime1At,
      verifyTime2At,
      verifyTime1Min,
      verifyTime2Min,
      taskStartTime
    });

    if (configuredAtStr) {
      fireAt = new Date(configuredAtStr).getTime();
      console.log(`LocationReverification: Using configured timestamp for Verification ${isFirst ? 1 : 2}:`, configuredAtStr, 'epoch:', fireAt);
      // If that moment already passed, trigger in 2 seconds to let UI settle
      if (fireAt <= Date.now()) {
        console.log('LocationReverification: Configured timestamp is in the past. Triggering in 2s.');
        fireAt = Date.now() + 2000;
      }
    } else {
      // Fallback if timestamps are missing
      const configuredMin = isFirst ? verifyTime1Min : verifyTime2Min;
      console.log('LocationReverification: Configured timestamp missing, checking minutes fallback:', configuredMin);
      if (configuredMin != null && configuredMin > 0 && taskStartTime) {
        fireAt = new Date(taskStartTime).getTime() + configuredMin * 60 * 1000;
        console.log('LocationReverification: Calculated fire time from start time:', new Date(fireAt).toISOString());
        if (fireAt <= Date.now()) {
          console.log('LocationReverification: Calculated fire time is in the past. Triggering in 2s.');
          fireAt = Date.now() + 2000;
        }
      } else {
        const minMs = isFirst ? FIRST_MIN_MS : SECOND_MIN_MS;
        const maxMs = isFirst ? FIRST_MAX_MS : SECOND_MAX_MS;
        fireAt = Date.now() + Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        console.log('LocationReverification: Generated random fire time:', new Date(fireAt).toISOString());
      }
    }

    setNextCheckAt(fireAt);
    const initialSeconds = Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));
    setSecondsToNext(initialSeconds);
    console.log(`LocationReverification: Scheduled verification ${isFirst ? 1 : 2} in ${initialSeconds} seconds.`);

    const triggerPopup = () => {
      if (!isTaskActive) {
        console.log('LocationReverification: triggerPopup called but task is inactive.');
        return;
      }
      console.log('LocationReverification: TRIGGERING POPUP DIALOG NOW!');
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
        const missedNumber = verificationsCompleted + 1;
        console.log(`LocationReverification: Timeout reached. Verification ${missedNumber} missed.`);
        setShowDialog(false);
        setVerificationsCompleted(prev => prev + 1);
        logVerification({
          status: 'missed',
          verificationNumber: missedNumber,
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

    // Poll every second so the popup fires at the right wall-clock time even
    // after tab throttling or device sleep.
    nextTickRef.current = setInterval(() => {
      const remaining = Math.ceil((fireAt - Date.now()) / 1000);
      setSecondsToNext(Math.max(0, remaining));

      // Log countdown every 15 seconds to avoid flooding but show it's active
      if (remaining > 0 && remaining % 15 === 0) {
        console.log(`LocationReverification: Countdown to Verification ${isFirst ? 1 : 2}: ${remaining}s remaining.`);
      }

      if (Date.now() >= fireAt) {
        console.log('LocationReverification: Current time reached/passed target time. Firing popup.');
        if (nextTickRef.current) clearInterval(nextTickRef.current);
        triggerPopup();
      }
    }, 1000);
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, clearAllTimers, notifySupervisor, logVerification, verifyTime1Min, verifyTime2Min, verifyTime1At, verifyTime2At, taskStartTime]);

  useEffect(() => {
    if (!loading && isTaskActive && locationTypeIsFarm && verificationsCompleted < MAX_VERIFICATIONS) {
      scheduleNextCheck();
    }
    return () => clearAllTimers();
  }, [loading, isTaskActive, locationTypeIsFarm, verificationsCompleted, scheduleNextCheck, clearAllTimers]);

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
          description: `Verification ${newCount}/${MAX_VERIFICATIONS} complete. Keep up the good work!`,
        });
        setTimeout(() => {
          setShowDialog(false);
          if (newCount < MAX_VERIFICATIONS) {
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

  if (!isTaskActive || !locationTypeIsFarm) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatNextCheck = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} min` : `${m}m ${s}s`;
  };

  return (
    <>
      {/* Countdown indicator removed — workers no longer see a pre-popup timer. */}

      <Dialog open={showDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-orange-500 animate-pulse" />
              Location Re-verification ({verificationsCompleted + 1}/{MAX_VERIFICATIONS})
            </DialogTitle>
          </DialogHeader>

          <Card className="p-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Confirm you are still at the farm location</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You must verify within 2 minutes or your supervisor will be notified.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <span className={`text-xl font-mono font-bold ${timeRemaining <= 30 ? 'text-destructive' : ''}`}>
              {formatTime(timeRemaining)}
            </span>
            <span className="text-sm text-muted-foreground">remaining</span>
          </div>

          {result === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Location verified! Continue working.</span>
            </div>
          )}

          {result === 'failed' && (
            <div className="flex items-center gap-2 p-3 rounded bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive font-medium">
                Not at work site! Supervisor has been notified.
              </span>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={checking || result === 'success'}
            className="w-full"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {checking ? 'Checking Location...' : 'Verify My Location'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
