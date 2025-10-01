import { useEffect, useState } from 'react';
import { Motion } from '@capacitor/motion';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface ActivityTrackerProps {
  taskId: string;
  userId: string;
  isTracking: boolean;
}

type ActivityLevel = 'idle' | 'light' | 'moderate' | 'active';

export function ActivityTracker({ taskId, userId, isTracking }: ActivityTrackerProps) {
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('idle');
  const [activityData, setActivityData] = useState<any[]>([]);

  useEffect(() => {
    if (!isTracking) {
      setActivityLevel('idle');
      setActivityData([]);
      return;
    }

    let accelerometerHandler: any;
    
    const startTracking = async () => {
      try {
        accelerometerHandler = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.acceleration;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          
          // Determine activity level based on acceleration magnitude
          let level: ActivityLevel;
          if (magnitude < 1) level = 'idle';
          else if (magnitude < 3) level = 'light';
          else if (magnitude < 6) level = 'moderate';
          else level = 'active';

          setActivityLevel(level);
          setActivityData(prev => [...prev, { timestamp: Date.now(), magnitude, level }]);
        });
      } catch (error) {
        console.error('Failed to start motion tracking:', error);
      }
    };

    startTracking();

    // Log activity data every 5 minutes
    const logInterval = setInterval(async () => {
      if (activityData.length > 0) {
        const activitySummary = {
          idle: activityData.filter(d => d.level === 'idle').length,
          light: activityData.filter(d => d.level === 'light').length,
          moderate: activityData.filter(d => d.level === 'moderate').length,
          active: activityData.filter(d => d.level === 'active').length,
        };

        await supabase.from('activity_logs').insert({
          user_id: userId,
          task_id: taskId,
          activity_data_json: activitySummary,
          status: activityLevel,
        });

        setActivityData([]);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (accelerometerHandler) {
        accelerometerHandler.remove();
      }
      clearInterval(logInterval);
    };
  }, [isTracking, taskId, userId, activityData, activityLevel]);

  if (!isTracking) return null;

  const getActivityColor = () => {
    switch (activityLevel) {
      case 'idle': return 'text-gray-500';
      case 'light': return 'text-blue-500';
      case 'moderate': return 'text-yellow-500';
      case 'active': return 'text-green-500';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Activity className={`h-5 w-5 ${getActivityColor()}`} />
        <div>
          <p className="text-sm font-medium">Activity Level</p>
          <p className={`text-xs ${getActivityColor()}`}>{activityLevel.toUpperCase()}</p>
        </div>
      </div>
    </Card>
  );
}
