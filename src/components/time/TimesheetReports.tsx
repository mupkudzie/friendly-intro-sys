import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  format,
  eachDayOfInterval,
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  createBrandedPDF,
  addSectionTitle,
  addKeyValueGrid,
  addTable,
  addApprovalBlock,
  addFooterToAllPages,
  downloadPDF,
} from '@/lib/pdf';

interface WorkerOption {
  user_id: string;
  full_name: string;
  email?: string | null;
  contact_number?: string | null;
  department?: string | null;
}

interface TimeLogRow {
  id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  break_time: number | null;
  task?: { title: string | null } | null;
}

interface VerificationRow {
  id: string;
  status: string;
  triggered_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

type ViewMode = 'weekly' | 'monthly';

export function TimesheetReports() {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');

  const [timeLogs, setTimeLogs] = useState<TimeLogRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (viewMode === 'weekly') {
      return { start: startOfWeek(refDate, { weekStartsOn: 1 }), end: endOfWeek(refDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
  }, [refDate, viewMode]);

  // Load workers
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, contact_number, department')
        .in('role', ['student', 'garden_worker'])
        .eq('is_deleted', false)
        .order('full_name');
      if (data) setWorkers(data as WorkerOption[]);
    };
    load();
  }, []);

  // Load data for range
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startISO = range.start.toISOString();
      const endISO = range.end.toISOString();

      let timeQ = supabase
        .from('time_logs')
        .select('id, user_id, task_id, start_time, end_time, total_hours, break_time, task:tasks(title)')
        .gte('start_time', startISO)
        .lte('start_time', endISO)
        .order('start_time', { ascending: true });
      if (selectedWorkerId !== 'all') timeQ = timeQ.eq('user_id', selectedWorkerId);

      let vQ = supabase
        .from('verification_logs')
        .select('id, status, triggered_at, user_id')
        .gte('triggered_at', startISO)
        .lte('triggered_at', endISO);
      if (selectedWorkerId !== 'all') vQ = vQ.eq('user_id', selectedWorkerId);

      let tQ = supabase
        .from('tasks')
        .select('id, title, status, updated_at, assigned_to')
        .gte('updated_at', startISO)
        .lte('updated_at', endISO)
        .eq('status', 'approved');
      if (selectedWorkerId !== 'all') tQ = tQ.eq('assigned_to', selectedWorkerId);

      const [tLogs, vLogs, tList] = await Promise.all([timeQ, vQ, tQ]);

      setTimeLogs((tLogs.data || []) as any);
      setVerifications((vLogs.data || []) as any);
      setTasks((tList.data || []) as any);
      setLoading(false);
    };
    load();
  }, [range, selectedWorkerId]);

  // Stats
  const totalHours = useMemo(
    () => timeLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0),
    [timeLogs]
  );
  const completedTasks = tasks.length;
  const verificationStats = useMemo(() => {
    const total = verifications.length;
    const success = verifications.filter(v => v.status === 'success').length;
    const failed = verifications.filter(v => v.status === 'failed').length;
    const missed = verifications.filter(v => v.status === 'missed').length;
    const compliance = total > 0 ? Math.round((success / total) * 100) : 100;
    return { total, success, failed, missed, compliance };
  }, [verifications]);

  // Daily breakdown for the table view
  const dailyBreakdown = useMemo(() => {
    const days = eachDayOfInterval({ start: range.start, end: range.end });
    return days.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayLogs = timeLogs.filter(l => format(new Date(l.start_time), 'yyyy-MM-dd') === dayKey);
      const dayHours = dayLogs.reduce((s, l) => s + (l.total_hours || 0), 0);
      const dayTasks = tasks.filter(t => format(new Date(t.updated_at), 'yyyy-MM-dd') === dayKey).length;
      const dayVerifs = verifications.filter(v => format(new Date(v.triggered_at), 'yyyy-MM-dd') === dayKey);
      const verifSuccess = dayVerifs.filter(v => v.status === 'success').length;
      return {
        date: day,
        hours: dayHours,
        sessions: dayLogs.length,
        tasks: dayTasks,
        verifTotal: dayVerifs.length,
        verifSuccess,
      };
    });
  }, [range, timeLogs, tasks, verifications]);

  const handlePrev = () => {
    setRefDate(prev => (viewMode === 'weekly' ? addWeeks(prev, -1) : addMonths(prev, -1)));
  };
  const handleNext = () => {
    setRefDate(prev => (viewMode === 'weekly' ? addWeeks(prev, 1) : addMonths(prev, 1)));
  };

  const handleDownloadPDF = () => {
    try {
      const worker = workers.find(w => w.user_id === selectedWorkerId);
      const workerName = selectedWorkerId === 'all' ? 'All Farm Workers' : worker?.full_name || 'Worker';
      const periodLabel =
        viewMode === 'weekly'
          ? `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`
          : format(range.start, 'MMMM yyyy');

      const doc = createBrandedPDF({
        title: `${viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Timesheet Report`,
        subtitle: `${workerName} • ${periodLabel}`,
      });

      let y = 50;
      y = addSectionTitle(doc, 'Worker Details', y);
      y = addKeyValueGrid(
        doc,
        [
          { label: 'Worker', value: workerName },
          { label: 'Email', value: worker?.email || '—' },
          { label: 'Contact', value: worker?.contact_number || '—' },
          { label: 'Department', value: worker?.department || '—' },
          { label: 'Period', value: periodLabel },
          { label: 'Generated By', value: userProfile?.full_name || '—' },
        ],
        y
      );

      y = addSectionTitle(doc, 'Summary', y + 4);
      y = addKeyValueGrid(
        doc,
        [
          { label: 'Total Hours Worked', value: `${totalHours.toFixed(2)} h` },
          { label: 'Tasks Completed', value: `${completedTasks}` },
          { label: 'Verification Compliance', value: `${verificationStats.compliance}%` },
          { label: 'Verifications (S / F / M)', value: `${verificationStats.success} / ${verificationStats.failed} / ${verificationStats.missed}` },
        ],
        y
      );

      y = addSectionTitle(doc, 'Daily Breakdown', y + 2);
      y = addTable(
        doc,
        ['Date', 'Hours', 'Sessions', 'Tasks Done', 'Verif. (✓ / Total)'],
        dailyBreakdown.map(d => [
          format(d.date, 'EEE, MMM d'),
          d.hours.toFixed(2),
          String(d.sessions),
          String(d.tasks),
          `${d.verifSuccess} / ${d.verifTotal}`,
        ]),
        y
      );

      if (timeLogs.length > 0) {
        y = addSectionTitle(doc, 'Task Time Entries', y);
        y = addTable(
          doc,
          ['Date', 'Task', 'Clock In', 'Clock Out', 'Hours'],
          timeLogs.map(l => [
            format(new Date(l.start_time), 'MMM d'),
            l.task?.title || '—',
            format(new Date(l.start_time), 'HH:mm'),
            l.end_time ? format(new Date(l.end_time), 'HH:mm') : '—',
            (l.total_hours || 0).toFixed(2),
          ]),
          y
        );
      }

      addApprovalBlock(doc, y);
      addFooterToAllPages(doc);

      const filename = `Timesheet_${workerName.replace(/\s+/g, '_')}_${format(range.start, 'yyyy-MM-dd')}.pdf`;
      downloadPDF(doc, filename);

      toast({ title: 'Timesheet downloaded', description: `Saved as ${filename}` });
    } catch (e: any) {
      toast({ title: 'Failed to generate PDF', description: e.message, variant: 'destructive' });
    }
  };

  const periodLabel =
    viewMode === 'weekly'
      ? `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`
      : format(range.start, 'MMMM yyyy');

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Timesheet Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Weekly & monthly views with hours, tasks and verification compliance
              </p>
            </div>
            <Button onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 min-w-[220px] justify-center">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{periodLabel}</span>
              </div>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 max-w-sm">
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Farm Workers</SelectItem>
                  {workers.map(w => (
                    <SelectItem key={w.user_id} value={w.user_id}>
                      {w.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
              <Clock className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">{completedTasks}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Verification Compliance</p>
                <p className="text-2xl font-bold">{verificationStats.compliance}%</p>
              </div>
              <ShieldCheck className="w-8 h-8 text-blue-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Missed Verifications</p>
                <p className="text-2xl font-bold text-destructive">{verificationStats.missed}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Tasks Done</TableHead>
                  <TableHead className="text-right">Verifications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyBreakdown.map(d => (
                  <TableRow key={d.date.toISOString()}>
                    <TableCell className="font-medium">{format(d.date, 'EEE, MMM d')}</TableCell>
                    <TableCell className="text-right font-mono">{d.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{d.sessions}</TableCell>
                    <TableCell className="text-right">{d.tasks}</TableCell>
                    <TableCell className="text-right">
                      {d.verifTotal === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            d.verifSuccess === d.verifTotal
                              ? 'border-emerald-500 text-emerald-700'
                              : 'border-amber-500 text-amber-700'
                          }
                        >
                          {d.verifSuccess}/{d.verifTotal}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {loading && (
            <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
