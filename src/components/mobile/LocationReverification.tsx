import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
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
const RANDOM_MIN_MS = 3 * 60 * 1000;
const RANDOM_MAX_MS = 8 * 60 * 1000;

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
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [nextCheckAt, setNextCheckAt] = useState<number | null>(null); // epoch ms
  const [secondsToNext, setSecondsToNext] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const nextTickRef = useRef<NodeJS.Timeout | null>(null);

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
      setNextCheckAt(null);
      setSecondsToNext(null);
      return;
    }

    const exactTimes = [verifyTime1At, verifyTime2At];
    const exactForThis = exactTimes[verificationsCompleted];
    const customTimes = [verifyTime1Min, verifyTime2Min];
    const customForThis = customTimes[verificationsCompleted];
    let interval: number;

    if (exactForThis) {
      // Exact wall-clock time wins — fire at that moment (or immediately if already past)
      const targetMs = new Date(exactForThis).getTime();
      interval = Math.max(targetMs - Date.now(), 1000);
    } else if (customForThis && customForThis > 0 && taskStartTime) {
      const elapsed = Date.now() - new Date(taskStartTime).getTime();
      const targetMs = customForThis * 60 * 1000;
      interval = Math.max(targetMs - elapsed, 5000);
    } else {
      interval = Math.floor(Math.random() * (RANDOM_MAX_MS - RANDOM_MIN_MS) + RANDOM_MIN_MS);
    }

    const fireAt = Date.now() + interval;
    setNextCheckAt(fireAt);
    setSecondsToNext(Math.ceil(interval / 1000));

    // Tick the visible "next verification in X" countdown every second
    nextTickRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));
      setSecondsToNext(remaining);
      if (remaining <= 0 && nextTickRef.current) {
        clearInterval(nextTickRef.current);
      }
    }, 1000);

    timerRef.current = setTimeout(() => {
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
    }, interval);
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, clearAllTimers, notifySupervisor, taskStartTime, verifyTime1Min, verifyTime2Min, verifyTime1At, verifyTime2At, logVerification]);

  useEffect(() => {
    if (isTaskActive && locationTypeIsFarm && verificationsCompleted < MAX_VERIFICATIONS) {
      scheduleNextCheck();
    }
    return () => clearAllTimers();
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, scheduleNextCheck, clearAllTimers]);

  const handleVerify = async () => {
    setChecking(true);
    const verificationNumber = verificationsCompleted + 1;
    try {
      let position: any;
      try {
        position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      } catch {
        try {
          position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 20000 });
        } catch {
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (p) => resolve(p),
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
              );
            });
          } else {
            throw new Error('Geolocation unavailable');
          }
        }
      }

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );

      const isWithin = distance <= taskLocation.radius;
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
        description: 'Failed to check location. Please enable GPS.',
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
      {/* Always-visible countdown indicator (non-disruptive) */}
      {!showDialog && verificationsCompleted < MAX_VERIFICATIONS && secondsToNext !== null && (
        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Next location check</p>
                <p className="text-sm font-semibold truncate">
                  in {formatNextCheck(secondsToNext)}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {verificationsCompleted}/{MAX_VERIFICATIONS} done
            </span>
          </div>
        </Card>
      )}

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
