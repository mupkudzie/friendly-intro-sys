import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, User, Mail, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingUser {
  user_id: string;
  full_name: string;
  role: string;
  contact_number?: string;
  department?: string;
  student_id?: string;
  approval_status: string;
  created_at: string;
  email?: string;
}

export function UserApproval() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Use email from profiles table
      setPendingUsers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (user: PendingUser) => {
    setActionLoading(true);
    try {
      // Update approval status
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;

      // Create role entry
      const roleMap: { [key: string]: 'admin' | 'supervisor' | 'student' | 'garden_worker' } = {
        admin: 'admin',
        supervisor: 'supervisor',
        student: 'student',
        garden_worker: 'garden_worker',
      };

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.user_id,
          role: roleMap[user.role],
        });

      if (roleError) throw roleError;

      // Send approval email
      await supabase.functions.invoke('send-approval-email', {
        body: {
          email: user.email,
          name: user.full_name,
          status: 'approved',
        },
      });

      toast({
        title: 'Success',
        description: `${user.full_name} has been approved and notified via email.`,
      });

      fetchPendingUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectReason,
        })
        .eq('user_id', selectedUser.user_id);

      if (updateError) throw updateError;

      // Send rejection email
      await supabase.functions.invoke('send-approval-email', {
        body: {
          email: selectedUser.email,
          name: selectedUser.full_name,
          status: 'rejected',
          reason: rejectReason,
        },
      });

      toast({
        title: 'User Rejected',
        description: `${selectedUser.full_name} has been notified.`,
      });

      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedUser(null);
      fetchPendingUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading pending approvals...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pending User Approvals</h2>
        <p className="text-muted-foreground">
          Review and approve or reject new user registrations
        </p>
      </div>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              No pending approvals
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingUsers.map((user) => (
            <Card key={user.user_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {user.full_name}
                    </CardTitle>
                    <Badge variant="outline">
                      {user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{user.email}</span>
                    </div>
                  )}
                  {user.contact_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{user.contact_number}</span>
                    </div>
                  )}
                  {user.department && (
                    <div>
                      <span className="font-semibold">Department:</span> {user.department}
                    </div>
                  )}
                  {user.student_id && (
                    <div>
                      <span className="font-semibold">Student ID:</span> {user.student_id}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(user)}
                    disabled={actionLoading}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowRejectDialog(true);
                    }}
                    disabled={actionLoading}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {selectedUser?.full_name}'s registration.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason || actionLoading}
            >
              Reject User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
