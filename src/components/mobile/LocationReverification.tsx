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
import { MapPin, AlertTriangle, CheckCircle, XCircle, Volume2, Timer } from 'lucide-react';
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
  onVerificationFailed?: () => void;
}

const MAX_VERIFICATIONS = 2;
const TIMEOUT_DURATION = 2 * 60 * 1000; // 2 minutes


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
  onVerificationFailed,
}: LocationReverificationProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  const [verificationsCompleted, setVerificationsCompleted] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(120); // seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const notifySupervisor = useCallback(async (reason: string) => {
    try {
      // Find supervisor (task assigned_by)
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
  }, []);

  const scheduleNextCheck = useCallback(() => {
    clearAllTimers();
    if (!isTaskActive || !locationTypeIsFarm || verificationsCompleted >= MAX_VERIFICATIONS) return;

    // Determine interval
    const customTimes = [verifyTime1Min, verifyTime2Min];
    const customForThis = customTimes[verificationsCompleted];
    let interval: number;

    if (customForThis && customForThis > 0 && taskStartTime) {
      // Supervisor specified an exact minute mark — schedule relative to task start
      const elapsed = Date.now() - new Date(taskStartTime).getTime();
      const targetMs = customForThis * 60 * 1000;
      interval = Math.max(targetMs - elapsed, 5000); // at least 5s in the future
    } else {
      // Random interval (3-8 minutes)
      const minInterval = 3 * 60 * 1000;
      const maxInterval = 8 * 60 * 1000;
      interval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
    }

    timerRef.current = setTimeout(() => {
      playNotificationSound();
      setShowDialog(true);
      setResult(null);
      setTimeRemaining(120);

      // Start 2-minute countdown
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-dismiss after 2 minutes if not verified
      timeoutRef.current = setTimeout(() => {
        setShowDialog(false);
        setVerificationsCompleted(prev => prev + 1);
        notifySupervisor('did not respond to location verification within 2 minutes');
        toast({
          title: 'Verification Missed',
          description: 'You did not verify your location in time. Supervisor has been notified.',
          variant: 'destructive',
        });
      }, TIMEOUT_DURATION);
    }, interval);
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, clearAllTimers, notifySupervisor, taskStartTime, verifyTime1Min, verifyTime2Min]);

  useEffect(() => {
    if (isTaskActive && locationTypeIsFarm && verificationsCompleted < MAX_VERIFICATIONS) {
      scheduleNextCheck();
    }
    return () => clearAllTimers();
  }, [isTaskActive, locationTypeIsFarm, verificationsCompleted, scheduleNextCheck, clearAllTimers]);

  const handleVerify = async () => {
    setChecking(true);
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );

      const isWithin = distance <= taskLocation.radius;

      if (isWithin) {
        setResult('success');
        clearAllTimers();
        const newCount = verificationsCompleted + 1;
        setVerificationsCompleted(newCount);
        toast({
          title: 'Location Verified ✓',
          description: `Verification ${newCount}/${MAX_VERIFICATIONS} complete. Keep up the good work!`,
        });
        setTimeout(() => {
          setShowDialog(false);
          // Schedule next if more checks remain
          if (newCount < MAX_VERIFICATIONS) {
            scheduleNextCheck();
          }
        }, 2000);
      } else {
        setResult('failed');
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

  return (
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

        {/* Countdown timer */}
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
  );
}
