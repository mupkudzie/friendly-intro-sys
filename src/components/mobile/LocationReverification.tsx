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
import { MapPin, AlertTriangle, CheckCircle, XCircle, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface LocationReverificationProps {
  taskId: string;
  taskLocation: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  isTaskActive: boolean;
  locationTypeIsGarden: boolean;
  onVerificationFailed?: () => void;
}

const REVERIFICATION_MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum
const REVERIFICATION_MAX_INTERVAL = 15 * 60 * 1000; // 15 minutes maximum

function getRandomInterval() {
  return Math.floor(
    Math.random() * (REVERIFICATION_MAX_INTERVAL - REVERIFICATION_MIN_INTERVAL) +
      REVERIFICATION_MIN_INTERVAL
  );
}

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
    // Play a two-tone alert
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
  locationTypeIsGarden,
  onVerificationFailed,
}: LocationReverificationProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  const [failCount, setFailCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleNextCheck = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isTaskActive || !locationTypeIsGarden) return;

    const interval = getRandomInterval();
    timerRef.current = setTimeout(() => {
      playNotificationSound();
      setShowDialog(true);
      setResult(null);
    }, interval);
  }, [isTaskActive, locationTypeIsGarden]);

  useEffect(() => {
    if (isTaskActive && locationTypeIsGarden) {
      scheduleNextCheck();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isTaskActive, locationTypeIsGarden, scheduleNextCheck]);

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
        setFailCount(0);
        toast({
          title: 'Location Verified ✓',
          description: 'You are still at the work site. Keep up the good work!',
        });
        setTimeout(() => {
          setShowDialog(false);
          scheduleNextCheck();
        }, 2000);
      } else {
        setResult('failed');
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);
        toast({
          title: 'Location Verification Failed',
          description: `You are ${Math.round(distance)}m away from the work site.`,
          variant: 'destructive',
        });
        if (newFailCount >= 3 && onVerificationFailed) {
          onVerificationFailed();
        }
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

  const handleDismiss = () => {
    setShowDialog(false);
    scheduleNextCheck();
  };

  if (!isTaskActive || !locationTypeIsGarden) return null;

  return (
    <Dialog open={showDialog} onOpenChange={handleDismiss}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-orange-500 animate-pulse" />
            Location Re-verification
          </DialogTitle>
        </DialogHeader>

        <Card className="p-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Confirm you are still at the garden location</p>
              <p className="text-xs text-muted-foreground mt-1">
                Random verification to ensure you remain at the assigned work site.
              </p>
            </div>
          </div>
        </Card>

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
              Not at work site! Please return immediately.
              {failCount >= 2 && ' Warning: repeated failures will be reported.'}
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
