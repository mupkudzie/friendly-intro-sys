import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface WorkerWeekData {
  user_id: string;
  full_name: string;
  days: { [key: string]: number };
  total: number;
}

export function WeeklyTimesheetView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [workersData, setWorkersData] = useState<WorkerWeekData[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    fetchWeeklyData();
  }, [selectedDate]);

  const fetchWeeklyData = async () => {
    setLoading(true);
    
    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select(`
        user_id,
        start_time,
        total_hours,
        profiles:user_id (
          full_name
        )
      `)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString());

    if (!error && timeLogs) {
      const workerMap = new Map<string, WorkerWeekData>();
      
      timeLogs.forEach((log: any) => {
        const userId = log.user_id;
        const dayKey = format(new Date(log.start_time), 'yyyy-MM-dd');
        
        if (!workerMap.has(userId)) {
          workerMap.set(userId, {
            user_id: userId,
            full_name: log.profiles?.full_name || 'Unknown',
            days: {},
            total: 0
          });
        }
        
        const worker = workerMap.get(userId)!;
        worker.days[dayKey] = (worker.days[dayKey] || 0) + (log.total_hours || 0);
        worker.total += log.total_hours || 0;
      });
      
      setWorkersData(Array.from(workerMap.values()));
    }
    setLoading(false);
  };

  const formatHours = (hours: number | undefined) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${h} h ${m} m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">Weekly Timesheet</h2>
        
        <div className="flex gap-4 mb-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] h-11 justify-start text-left font-normal"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "MM/dd/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Card className="border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 font-medium text-sm sticky left-0 bg-muted/30 min-w-[140px]">
                    <div>Members</div>
                    <div className="text-xs font-normal text-muted-foreground mt-1">
                      {workersData.length}
                    </div>
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="text-center p-4 font-medium text-sm border-l min-w-[110px]">
                      <div className="text-foreground">{format(day, 'EEE')}</div>
                      <div className="text-xs font-normal text-muted-foreground mt-1">
                        {format(day, 'dd')}
                      </div>
                    </th>
                  ))}
                  <th className="text-center p-4 font-medium text-sm border-l bg-muted/30 sticky right-0 min-w-[120px]">
                    Total Hours
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : workersData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-muted-foreground">
                      No time entries found for this week
                    </td>
                  </tr>
                ) : (
                  workersData.map((worker) => (
                    <tr key={worker.user_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4 sticky left-0 bg-white">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {worker.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground text-sm">{worker.full_name}</span>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const hours = worker.days[dayKey];
                        return (
                          <td key={day.toISOString()} className="text-center p-4 border-l">
                            <span className="text-sm">{formatHours(hours)}</span>
                          </td>
                        );
                      })}
                      <td className="text-center p-4 border-l sticky right-0 bg-white">
                        <span className="text-sm font-semibold">{formatHours(worker.total)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
