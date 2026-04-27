import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  Clock,
  Image as ImageIcon,
  History,
  Trash2,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  ShieldCheck,
  ListChecks,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import {
  createBrandedPDF,
  addSectionTitle,
  addKeyValueGrid,
  addTable,
  addApprovalBlock,
  addFooterToAllPages,
  downloadPDF,
} from '@/lib/pdf';
import { Badge as BadgeUI } from '@/components/ui/badge';

interface UserDetailDialogProps {
  user: any;
  open: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

interface ActivityLog {
  id: string;
  task_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  initial_photos: any;
  final_photos: any;
  task?: {
    title: string;
    description: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  old_value: any;
  new_value: any;
}

export function UserDetailDialog({
  user,
  open,
  onClose,
  onUserUpdated,
}: UserDetailDialogProps) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newRole, setNewRole] = useState(user.role);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workerTasks, setWorkerTasks] = useState<any[]>([]);
  const [workerTimeLogs, setWorkerTimeLogs] = useState<any[]>([]);
  const [workerVerifications, setWorkerVerifications] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchActivityLogs();
      fetchAuditLogs();
      fetchWorkerData();
    }
  }, [open, user.user_id]);

  const fetchWorkerData = async () => {
    const [tasksRes, timeRes, verifRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, status, priority, created_at, updated_at, due_date, estimated_hours')
        .eq('assigned_to', user.user_id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('time_logs')
        .select('id, start_time, end_time, total_hours, break_time, task_id')
        .eq('user_id', user.user_id)
        .order('start_time', { ascending: false })
        .limit(200),
      supabase
        .from('verification_logs')
        .select('id, verification_number, status, latitude, longitude, distance_from_target, triggered_at, responded_at, task_id')
        .eq('user_id', user.user_id)
        .order('triggered_at', { ascending: false })
        .limit(200),
    ]);
    if (tasksRes.data) setWorkerTasks(tasksRes.data);
    if (timeRes.data) setWorkerTimeLogs(timeRes.data);
    if (verifRes.data) setWorkerVerifications(verifRes.data);
  };

  const fetchActivityLogs = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Fetch task titles for these logs
      const taskIds = Array.from(new Set(data.map((d: any) => d.task_id).filter(Boolean)));
      let taskMap: Record<string, { title: string; description?: string }> = {};
      if (taskIds.length) {
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id,title,description')
          .in('id', taskIds);
        tasksData?.forEach((t: any) => {
          taskMap[t.id] = { title: t.title, description: t.description };
        });
      }
      const withTasks = (data as any[]).map((d) => ({ ...d, task: taskMap[d.task_id] }));
      setActivityLogs(withTasks as any);
    }
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setAuditLogs(data);
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: newStatus })
      .eq('user_id', user.user_id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'User status updated successfully',
      });
      onUserUpdated();
    }
    setLoading(false);
  };

  const handleRoleChange = async () => {
    setLoading(true);
    
    // Update profile role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', user.user_id);

    // Update user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: user.user_id, role: newRole });

    if (profileError || roleError) {
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
      onUserUpdated();
    }
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!notes.trim()) return;

    setLoading(true);
    const { error } = await supabase.from('audit_logs').insert({
      user_id: user.user_id,
      action: 'Admin note added',
      entity_type: 'user',
      entity_id: user.user_id,
      new_value: { note: notes },
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Note added successfully',
      });
      setNotes('');
      fetchAuditLogs();
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-and-data', {
        body: { user_id: user.user_id },
      });

      if (error) throw error;

      toast({
        title: 'User Permanently Deleted',
        description: 'The user and all associated data have been removed from the system.',
      });
      onUserUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const renderPhotos = (photos: any) => {
    if (!photos) return null;
    const photoArray = Array.isArray(photos) ? photos : [photos];
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photoArray.map((photo: any, index: number) => (
          <div key={index} className="relative group">
            <img
              src={photo.url || photo}
              alt={`Photo ${index + 1}`}
              className="w-full h-32 object-cover rounded-lg border"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-white"
                onClick={() => window.open(photo.url || photo, '_blank')}
              >
                View Full
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl">{user.full_name}</div>
                <div className="text-sm text-muted-foreground font-normal">
                  {user.email}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Quick stats + PDF download */}
          {(() => {
            const totalHours = workerTimeLogs.reduce((s, l) => s + (l.total_hours || 0), 0);
            const completed = workerTasks.filter(t => t.status === 'approved').length;
            const inProgress = workerTasks.filter(t => t.status === 'in_progress' || t.status === 'pending').length;
            const verifSuccess = workerVerifications.filter(v => v.status === 'success').length;
            const verifTotal = workerVerifications.length;
            const compliance = verifTotal > 0 ? Math.round((verifSuccess / verifTotal) * 100) : 100;

            const handleDownloadWorkerPDF = () => {
              try {
                const doc = createBrandedPDF({
                  title: 'Farm Worker Report',
                  subtitle: `${user.full_name} • ${user.email || ''}`,
                });
                let y = 50;
                y = addSectionTitle(doc, 'Personal Information', y);
                y = addKeyValueGrid(doc, [
                  { label: 'Full Name', value: user.full_name },
                  { label: 'Email', value: user.email || '—' },
                  { label: 'Contact', value: user.contact_number || '—' },
                  { label: 'Department', value: user.department || '—' },
                  { label: 'Role', value: String(user.role).replace('_', ' ') },
                  { label: 'Member Since', value: format(new Date(user.created_at), 'MMM d, yyyy') },
                ], y);

                y = addSectionTitle(doc, 'Performance Summary', y + 2);
                y = addKeyValueGrid(doc, [
                  { label: 'Total Hours', value: `${totalHours.toFixed(2)} h` },
                  { label: 'Tasks Completed', value: String(completed) },
                  { label: 'Active Tasks', value: String(inProgress) },
                  { label: 'Verification Compliance', value: `${compliance}%` },
                ], y);

                if (workerTasks.length) {
                  y = addSectionTitle(doc, 'Recent Task History', y + 2);
                  y = addTable(doc,
                    ['Date', 'Task', 'Priority', 'Status'],
                    workerTasks.slice(0, 30).map(t => [
                      format(new Date(t.created_at), 'MMM d, yyyy'),
                      t.title,
                      t.priority,
                      String(t.status).replace('_', ' '),
                    ]), y);
                }

                if (workerVerifications.length) {
                  y = addSectionTitle(doc, 'Verification Log', y);
                  y = addTable(doc,
                    ['Triggered', '#', 'Status', 'Distance (m)'],
                    workerVerifications.slice(0, 30).map(v => [
                      format(new Date(v.triggered_at), 'MMM d HH:mm'),
                      String(v.verification_number),
                      v.status,
                      v.distance_from_target != null ? Math.round(v.distance_from_target).toString() : '—',
                    ]), y);
                }

                addApprovalBlock(doc, y);
                addFooterToAllPages(doc);
                downloadPDF(doc, `Worker_Report_${user.full_name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                toast({ title: 'Worker report downloaded' });
              } catch (e: any) {
                toast({ title: 'Failed to generate report', description: e.message, variant: 'destructive' });
              }
            };

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                    <p className="text-xl font-bold">{totalHours.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-xl font-bold text-emerald-600">{completed}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-xl font-bold text-blue-600">{inProgress}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Compliance</p>
                    <p className="text-xl font-bold">{compliance}%</p>
                  </div>
                </div>
                <Button onClick={handleDownloadWorkerPDF} className="mb-4 gap-2" size="sm">
                  <Download className="w-4 h-4" />
                  Download Worker Report (PDF)
                </Button>
              </>
            );
          })()}

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="tasks">
                <ListChecks className="w-3.5 h-3.5 mr-1" />Tasks
              </TabsTrigger>
              <TabsTrigger value="verifications">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />Verifications
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Task History</CardTitle></CardHeader>
                <CardContent>
                  {workerTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {workerTasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded border">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(t.created_at), 'MMM d, yyyy')} • {t.priority}
                            </p>
                          </div>
                          <BadgeUI variant="outline" className="ml-2 shrink-0">{String(t.status).replace('_', ' ')}</BadgeUI>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="verifications" className="space-y-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Verification Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {workerVerifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No verification events recorded.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {workerVerifications.map(v => {
                        const statusColor =
                          v.status === 'success' ? 'border-emerald-500 text-emerald-700' :
                          v.status === 'failed' ? 'border-amber-500 text-amber-700' :
                          'border-red-500 text-red-700';
                        return (
                          <div key={v.id} className="flex items-center justify-between p-2 rounded border">
                            <div className="min-w-0">
                              <p className="text-sm">
                                Verification #{v.verification_number}
                                {v.distance_from_target != null && (
                                  <span className="text-muted-foreground"> • {Math.round(v.distance_from_target)}m</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(v.triggered_at), 'MMM d, yyyy HH:mm')}
                              </p>
                            </div>
                            <BadgeUI variant="outline" className={`ml-2 shrink-0 ${statusColor}`}>
                              {v.status === 'missed' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {v.status}
                            </BadgeUI>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Full Name</div>
                      <div className="font-medium">{user.full_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div className="font-medium">{user.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Contact</div>
                      <div className="font-medium">{user.contact_number || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Department</div>
                      <div className="font-medium">{user.department || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Contact</div>
                      <div className="font-medium">{user.contact_number || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Member Since</div>
                      <div className="font-medium">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4" />
                    <div>
                      <div className="text-sm text-muted-foreground">Account Status</div>
                      <Badge variant={user.approval_status === 'approved' ? 'default' : 'secondary'}>
                        {user.approval_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4" />
                    <div>
                      <div className="text-sm text-muted-foreground">Role</div>
                      <Badge>{user.role.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Activity History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 pb-4 border-b last:border-0">
                        <div className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{log.action}</div>
                          <div className="text-sm text-muted-foreground">
                            {log.entity_type}
                          </div>
                          {log.new_value?.note && (
                            <div className="mt-1 text-sm bg-muted p-2 rounded">
                              {log.new_value.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No activity history available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Account Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Account Status</label>
                    <div className="flex gap-2">
                      <Button
                        variant={user.approval_status === 'approved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusChange('approved')}
                        disabled={loading}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant={user.approval_status === 'rejected' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusChange('rejected')}
                        disabled={loading}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Change Role</label>
                    <div className="flex gap-2">
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="garden_worker">Farm Worker</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleRoleChange}
                        disabled={loading || newRole === user.role}
                      >
                        Update
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Add Note
                    </label>
                    <Textarea
                      placeholder="Add a note about this user..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                    <Button
                      className="mt-2"
                      onClick={handleAddNote}
                      disabled={loading || !notes.trim()}
                      size="sm"
                    >
                      Save Note
                    </Button>
                  </div>

                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium mb-2 block text-destructive">
                      Danger Zone
                    </label>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete User Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
