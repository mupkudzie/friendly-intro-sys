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

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

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
