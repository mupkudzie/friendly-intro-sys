import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin } from 'lucide-react';

interface AutoCheckInOutProps {
  userId: string;
}

export function AutoCheckInOut({ userId }: AutoCheckInOutProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isInGeofence, setIsInGeofence] = useState(false);

  useEffect(() => {
    checkCurrentStatus();
    startLocationTracking();
  }, [userId]);

  const checkCurrentStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', `${today}T00:00:00`)
        .is('end_time', null)
        .single();

      if (!error && data) {
        setIsCheckedIn(true);
        setCheckInTime(data.start_time);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const startLocationTracking = () => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setCurrentLocation(location);
          await checkGeofence(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000,
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
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

      // Auto check-in when entering geofence
      if (inAnyZone && !isCheckedIn) {
        await handleAutoCheckIn();
      }

      // Auto check-out when leaving geofence
      if (!inAnyZone && isCheckedIn) {
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
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Attendance Status</p>
              <p className="text-xs text-muted-foreground">
                {isCheckedIn
                  ? `Checked in at ${checkInTime ? new Date(checkInTime).toLocaleTimeString() : ''}`
                  : 'Not checked in'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={isInGeofence ? 'default' : 'secondary'}>
              <MapPin className="w-3 h-3 mr-1" />
              {isInGeofence ? 'In Farm Zone' : 'Outside Zone'}
            </Badge>
            <Badge variant={isCheckedIn ? 'default' : 'secondary'}>
              {isCheckedIn ? 'Checked In' : 'Checked Out'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
