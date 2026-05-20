import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Export refresh function for other components to use
export const refreshCheckInStatus = () => {
  window.dispatchEvent(new CustomEvent('refresh-checkin-status'));
};

interface AutoCheckInOutProps {
  userId: string;
}

// Custom event for refreshing check-in status
const CHECK_IN_REFRESH_EVENT = 'refresh-checkin-status';

export function AutoCheckInOut({ userId }: AutoCheckInOutProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isInGeofence, setIsInGeofence] = useState(false);

  useEffect(() => {
    checkCurrentStatus();
    startLocationTracking();
    
    // Listen for refresh events when a task is started
    const handleRefresh = () => {
      checkCurrentStatus();
    };
    window.addEventListener(CHECK_IN_REFRESH_EVENT, handleRefresh);
    
    return () => {
      window.removeEventListener(CHECK_IN_REFRESH_EVENT, handleRefresh);
    };
  }, [userId]);

  const checkCurrentStatus = async () => {
    try {
      const { data } = await supabase
        .from('time_logs')
        .select('start_time, end_time')
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setIsCheckedIn(true);
        setCheckInTime(data.start_time);
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const startLocationTracking = () => {
    if ('geolocation' in navigator) {
      let stopped = false;
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          if (stopped) return;
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setCurrentLocation(location);
          await checkGeofence(location);
        },
        (error) => {
          // Stop watching on permission denied to avoid infinite error spam.
          if (error?.code === 1) {
            stopped = true;
            navigator.geolocation.clearWatch(watchId);
            return;
          }
          // Silently ignore transient timeouts/unavailable to keep console clean.
        },
        {
          enableHighAccuracy: false,
          maximumAge: 30000,
          timeout: 30000,
        }
      );

      return () => {
        stopped = true;
        navigator.geolocation.clearWatch(watchId);
      };
    }
  };

  const checkGeofence = async (location: { lat: number; lon: number }) => {
    try {
      const { data: zones } = await supabase
        .from('farm_zones')
        .select('*')
        .eq('active', true);

      if (!zones || zones.length === 0) return;

      let inAnyZone = false;
      for (const zone of zones) {
        const coords = zone.gps_coordinates as any;
        const distance = calculateDistance(
          location.lat,
          location.lon,
          coords.lat,
          coords.lon
        );
        
        const radius = coords.radius || 100;
        if (distance <= radius) {
          inAnyZone = true;
          break;
        }
      }

      setIsInGeofence(inAnyZone);

      // Check for an active task — never auto-checkout while a task is in progress
      const { data: activeTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_to', userId)
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle();

      // Auto check-in when entering geofence (only if no task already running)
      if (inAnyZone && !isCheckedIn && !activeTask) {
        await handleAutoCheckIn();
      }

      // Auto check-out when leaving geofence — disabled while a task is active
      if (!inAnyZone && isCheckedIn && !activeTask) {
        await handleAutoCheckOut();
      }
    } catch (error) {
      console.error('Error checking geofence:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleAutoCheckIn = async () => {
    try {
      // Get any active task to associate with check-in
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_to', userId)
        .eq('status', 'in_progress')
        .limit(1)
        .single();

      const { error } = await supabase
        .from('time_logs')
        .insert({
          user_id: userId,
          task_id: activeTasks?.id || null,
          start_time: new Date().toISOString(),
          total_hours: 0,
        });

      if (error) throw error;

      setIsCheckedIn(true);
      setCheckInTime(new Date().toISOString());
      toast.success('Auto checked in - you entered the farm zone');
    } catch (error) {
      console.error('Auto check-in error:', error);
    }
  };

  const handleAutoCheckOut = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: timeLog } = await supabase
        .from('time_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', `${today}T00:00:00`)
        .is('end_time', null)
        .single();

      if (!timeLog) return;

      const endTime = new Date();
      const startTime = new Date(timeLog.start_time);
      const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('time_logs')
        .update({
          end_time: endTime.toISOString(),
          total_hours: hoursWorked,
        })
        .eq('id', timeLog.id);

      if (error) throw error;

      setIsCheckedIn(false);
      setCheckInTime(null);
      toast.info('Auto checked out - you left the farm zone');
    } catch (error) {
      console.error('Auto check-out error:', error);
    }
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 shadow-sm",
      isCheckedIn 
        ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-950 dark:text-emerald-50 shadow-emerald-500/5" 
        : "border-slate-200 bg-white/70 backdrop-blur-md text-slate-800"
    )}>
      {isCheckedIn && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-4 translate-x-4 blur-2xl" />
      )}
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-2xl shrink-0 transition-transform duration-200 hover:scale-105",
              isCheckedIn 
                ? "bg-emerald-500/10 text-emerald-600" 
                : "bg-slate-100 text-slate-500"
            )}>
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Shift Attendance</p>
              <h4 className={cn("text-[14px] font-black font-heading mt-0.5", isCheckedIn ? "text-emerald-900" : "text-slate-800")}>
                {isCheckedIn ? "Checked In & Active" : "Currently Offline / Checked Out"}
              </h4>
            </div>
          </div>
          
          <span className={cn(
            "w-2.5 h-2.5 rounded-full",
            isCheckedIn ? "bg-emerald-500 animate-ping" : "bg-slate-300"
          )} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 font-medium">
            {isCheckedIn
              ? `Shift began at ${checkInTime ? new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
              : 'Auto-checks in when you enter geofenced farm zones.'}
          </p>
          
          <div className="flex gap-2 shrink-0">
            <Badge 
              variant={isInGeofence ? 'default' : 'secondary'}
              className={cn(
                "rounded-lg px-2.5 py-0.5 text-[10px] font-bold border-0",
                isInGeofence 
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-100"
              )}
            >
              <MapPin className="w-3 h-3 mr-1" />
              {isInGeofence ? 'At Farm' : 'Outside Zone'}
            </Badge>
            <Badge 
              className={cn(
                "rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold border-0",
                isCheckedIn 
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              )}
              variant="default"
            >
              {isCheckedIn ? 'Active Shift' : 'Checked Out'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
