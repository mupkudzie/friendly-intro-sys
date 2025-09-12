import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Clock, Timer } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
}

interface ActiveTimeLog {
  id: string;
  task_id: string;
  start_time: string;
  task?: Task;
}

export function TimeLogger() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [activeTimeLog, setActiveTimeLog] = useState<ActiveTimeLog | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [breakTime, setBreakTime] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMyTasks();
    fetchActiveTimeLog();
  }, [userProfile]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimeLog) {
      interval = setInterval(() => {
        const startTime = new Date(activeTimeLog.start_time);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimeLog]);

  const fetchMyTasks = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userProfile.user_id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMyTasks(data);
    }
  };

  const fetchActiveTimeLog = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks(*)
      `)
      .eq('user_id', userProfile.user_id)
      .is('end_time', null)
      .maybeSingle();

    if (!error && data) {
      setActiveTimeLog(data);
    }
  };

  const startTimeTracking = async () => {
    if (!selectedTaskId || !userProfile) return;

    setLoading(true);

    // Check if there's already an active time log
    const { data: existingLog } = await supabase
      .from('time_logs')
      .select('*')
      .eq('user_id', userProfile.user_id)
      .is('end_time', null)
      .maybeSingle();

    if (existingLog) {
      toast({
        title: "Active Session Found",
        description: "Please end your current session before starting a new one.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('time_logs')
      .insert([{
        task_id: selectedTaskId,
        user_id: userProfile.user_id,
        start_time: new Date().toISOString(),
      }])
      .select(`
        *,
        task:tasks(*)
      `)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setActiveTimeLog(data);
      setSelectedTaskId('');
      
      // Update task status to in_progress
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', selectedTaskId);
      
      toast({
        title: "Time Tracking Started",
        description: `Started tracking time for ${data.task?.title}`,
      });
    }

    setLoading(false);
  };

  const endTimeTracking = async () => {
    if (!activeTimeLog || !userProfile) return;

    setLoading(true);

    const endTime = new Date();
    const startTime = new Date(activeTimeLog.start_time);
    const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const breakMinutes = breakTime ? parseFloat(breakTime) * 60 : 0;
    const workMinutes = Math.max(0, totalMinutes - breakMinutes);
    const totalHours = parseFloat((workMinutes / 60).toFixed(2));

    const { error } = await supabase
      .from('time_logs')
      .update({
        end_time: endTime.toISOString(),
        total_hours: totalHours,
        break_time: breakTime ? parseFloat(breakTime) : 0,
      })
      .eq('id', activeTimeLog.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Time Tracking Ended",
        description: `Logged ${totalHours} hours for ${activeTimeLog.task?.title}`,
      });
      setActiveTimeLog(null);
      setBreakTime('');
      setElapsedTime(0);
      fetchMyTasks();
    }

    setLoading(false);
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Active Time Tracking */}
      {activeTimeLog ? (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Timer className="w-5 h-5 animate-pulse" />
              Currently Tracking Time
            </CardTitle>
            <CardDescription className="text-green-700">
              {activeTimeLog.task?.title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-green-800">
                  {formatElapsedTime(elapsedTime)}
                </div>
                <div className="text-sm text-green-600">
                  Started at {format(new Date(activeTimeLog.start_time), 'HH:mm')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="break-time">Break Time (hours)</Label>
                  <Input
                    id="break-time"
                    type="number"
                    step="0.25"
                    min="0"
                    value={breakTime}
                    onChange={(e) => setBreakTime(e.target.value)}
                    placeholder="0.5"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={endTimeTracking} 
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {loading ? 'Ending...' : 'End Session'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Start Time Tracking
            </CardTitle>
            <CardDescription>
              Select a task and start tracking your work time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-select">Select Task</Label>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a task to work on" />
                  </SelectTrigger>
                  <SelectContent>
                    {myTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">{task.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={startTimeTracking} 
                disabled={!selectedTaskId || loading}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                {loading ? 'Starting...' : 'Start Tracking'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Tracking Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-foreground">How to track time:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Select a task from your assigned tasks</li>
                <li>Click "Start Tracking" when you begin work</li>
                <li>Enter any break time you took during the session</li>
                <li>Click "End Session" when you finish working</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-foreground">Tips:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Only track time when actively working on the task</li>
                <li>Include lunch breaks and other significant breaks in break time</li>
                <li>Short bathroom breaks don't need to be tracked</li>
                <li>Be honest and accurate with your time tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}