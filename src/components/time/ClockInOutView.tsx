import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimeEntry {
  id: string;
  user_id: string;
  full_name: string;
  clock_in: string | null;
  clock_out: string | null;
  time_worked: string;
}

export function ClockInOutView() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeEntries();
  }, [selectedDate]);

  const fetchTimeEntries = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        total_hours,
        profiles:user_id (
          full_name
        )
      `)
      .gte('start_time', `${dateStr} 00:00:00`)
      .lte('start_time', `${dateStr} 23:59:59`)
      .order('start_time', { ascending: true });

    if (!error && timeLogs) {
      const formatted = timeLogs.map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        full_name: log.profiles?.full_name || 'Unknown',
        clock_in: log.start_time ? format(new Date(log.start_time), 'h:mm a') : null,
        clock_out: log.end_time ? format(new Date(log.end_time), 'h:mm a') : null,
        time_worked: log.total_hours ? `${Math.floor(log.total_hours)} h ${Math.round((log.total_hours % 1) * 60)} m` : '-'
      }));
      setEntries(formatted);
    }
    setLoading(false);
  };

  const filteredEntries = entries.filter(entry =>
    entry.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clock In/Out</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-2 block">Search Member</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MM/dd/yyyy") : <span>Pick a date</span>}
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

          <div className="flex items-end">
            <Button className="bg-primary hover:bg-primary/90">
              See Today's Report
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Member Name</th>
                <th className="text-center p-4 font-medium border-l">Clock In</th>
                <th className="text-center p-4 font-medium border-l">Clock Out</th>
                <th className="text-center p-4 font-medium border-l">Time Worked</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center p-8 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-8 text-muted-foreground">
                    No time entries found for this date
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {entry.full_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{entry.full_name}</span>
                      </div>
                    </td>
                    <td className="text-center p-4 border-l">
                      {entry.clock_in || '-'}
                    </td>
                    <td className="text-center p-4 border-l">
                      {entry.clock_out || '-'}
                    </td>
                    <td className="text-center p-4 border-l font-medium">
                      {entry.time_worked}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
