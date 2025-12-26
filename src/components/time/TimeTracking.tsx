import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, User, Calendar, BarChart3, Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TimeLog {
  id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  break_time: number | null;
  task_id: string;
  user_id: string;
  task?: { title: string; description: string };
  profile?: { full_name: string; role: string };
}

interface TimeTrackingProps {
  userRole: string;
}

interface EditFormData {
  date: string;
  clockIn: string;
  clockOut: string;
  breakTime: string;
}

export function TimeTracking({ userRole }: TimeTrackingProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    averageHours: 0,
    totalSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    date: '',
    clockIn: '',
    clockOut: '',
    breakTime: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTimeLogs();
  }, [userProfile, userRole, selectedDate]);

  const fetchTimeLogs = async () => {
    if (!userProfile) return;

    let query = supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks(title, description),
        profile:profiles!user_id(full_name, role)
      `);

    // Filter based on user role
    if (userRole === 'admin') {
      // Admin sees all time logs
    } else if (userRole === 'supervisor') {
      // Supervisor sees all time logs (same view as admin for clock in/out)
    } else {
      // Workers see only their own time logs
      query = query.eq('user_id', userProfile.user_id);
    }

    // Filter by selected date
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());
    }

    const { data, error } = await query
      .order('start_time', { ascending: false })
      .limit(200);

    if (!error && data) {
      setTimeLogs(data);
      
      // Calculate stats
      const completedLogs = data.filter(log => log.total_hours);
      const totalHours = completedLogs.reduce((acc, log) => acc + (log.total_hours || 0), 0);
      const totalSessions = completedLogs.length;
      const averageHours = totalSessions > 0 ? totalHours / totalSessions : 0;

      setStats({
        totalHours,
        averageHours,
        totalSessions,
      });
    }
    setLoading(false);
  };

  const getStatusBadge = (log: TimeLog) => {
    if (!log.end_time) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    }
    if (log.total_hours) {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Ended</Badge>;
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openEditDialog = (log: TimeLog) => {
    setEditingLog(log);
    const startDate = new Date(log.start_time);
    setEditFormData({
      date: format(startDate, 'yyyy-MM-dd'),
      clockIn: format(startDate, 'HH:mm'),
      clockOut: log.end_time ? format(new Date(log.end_time), 'HH:mm') : '',
      breakTime: log.break_time?.toString() || '0',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog || !editFormData.date || !editFormData.clockIn) {
      toast({
        title: "Validation Error",
        description: "Date and Clock In time are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Parse the new times
      const [inHours, inMinutes] = editFormData.clockIn.split(':').map(Number);
      const newStartTime = new Date(editFormData.date);
      newStartTime.setHours(inHours, inMinutes, 0, 0);

      let newEndTime: Date | null = null;
      let totalHours: number | null = null;

      if (editFormData.clockOut) {
        const [outHours, outMinutes] = editFormData.clockOut.split(':').map(Number);
        newEndTime = new Date(editFormData.date);
        newEndTime.setHours(outHours, outMinutes, 0, 0);

        // Handle overnight shifts (clock out next day)
        if (newEndTime <= newStartTime) {
          newEndTime.setDate(newEndTime.getDate() + 1);
        }

        // Calculate total hours
        const breakHours = parseFloat(editFormData.breakTime) || 0;
        const diffMs = newEndTime.getTime() - newStartTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.max(0, parseFloat((diffHours - breakHours).toFixed(2)));
      }

      const updateData: Record<string, unknown> = {
        start_time: newStartTime.toISOString(),
        break_time: parseFloat(editFormData.breakTime) || 0,
      };

      if (newEndTime) {
        updateData.end_time = newEndTime.toISOString();
        updateData.total_hours = totalHours;
      } else {
        updateData.end_time = null;
        updateData.total_hours = null;
      }

      const { error } = await supabase
        .from('time_logs')
        .update(updateData)
        .eq('id', editingLog.id);

      if (error) throw error;

      toast({
        title: "Time Log Updated",
        description: "The time entry has been corrected successfully.",
      });

      setEditDialogOpen(false);
      setEditingLog(null);
      fetchTimeLogs();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update time log.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter logs by search term
  const filteredLogs = timeLogs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = log.profile?.full_name?.toLowerCase().includes(searchLower);
    const taskMatch = log.task?.title?.toLowerCase().includes(searchLower);
    return !searchTerm || nameMatch || taskMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading time tracking data...</div>
        </CardContent>
      </Card>
    );
  }

  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Session</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Time Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Clock In / Out Records</CardTitle>
              <CardDescription>
                {isAdminOrSupervisor ? 'All time tracking records' : 'Your time tracking history'}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {isAdminOrSupervisor && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or task..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 w-full sm:w-[250px]"
                  />
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Filter by date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setCurrentPage(1);
                    }}
                    initialFocus
                  />
                  {selectedDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedDate(undefined)}
                      >
                        Clear filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No time logs found
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {isAdminOrSupervisor && (
                        <TableHead className="font-semibold">Student Name</TableHead>
                      )}
                      <TableHead className="font-semibold">Task</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold text-center">Clock In</TableHead>
                      <TableHead className="font-semibold text-center">Clock Out</TableHead>
                      <TableHead className="font-semibold text-center">Break</TableHead>
                      <TableHead className="font-semibold text-center">Total Hours</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      {isAdminOrSupervisor && (
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        {isAdminOrSupervisor && (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {log.profile?.full_name ? getInitials(log.profile.full_name) : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{log.profile?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {log.profile?.role?.replace('_', ' ') || '-'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{log.task?.title || 'Unknown Task'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.start_time), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <span className="font-mono text-sm">
                            {format(new Date(log.start_time), 'HH:mm')}
                          </span>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {log.end_time ? (
                            <span className="font-mono text-sm">
                              {format(new Date(log.end_time), 'HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {log.break_time && log.break_time > 0 ? (
                            <span className="text-sm">{formatDuration(log.break_time)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">
                            {formatDuration(log.total_hours)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(log)}
                        </TableCell>
                        {isAdminOrSupervisor && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(log)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} records
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Time Log Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Correct the clock in/out times for{' '}
              <span className="font-medium">{editingLog?.profile?.full_name}</span>
              {editingLog?.task?.title && (
                <> on task "<span className="font-medium">{editingLog.task.title}</span>"</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-clock-in">Clock In</Label>
                <Input
                  id="edit-clock-in"
                  type="time"
                  value={editFormData.clockIn}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, clockIn: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-clock-out">Clock Out</Label>
                <Input
                  id="edit-clock-out"
                  type="time"
                  value={editFormData.clockOut}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, clockOut: e.target.value }))}
                  placeholder="Leave empty if still working"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-break">Break Time (hours)</Label>
              <Input
                id="edit-break"
                type="number"
                step="0.25"
                min="0"
                value={editFormData.breakTime}
                onChange={(e) => setEditFormData(prev => ({ ...prev, breakTime: e.target.value }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Enter break time in hours (e.g., 0.5 for 30 minutes)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}