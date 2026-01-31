import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, X, Clock, User, FileText, RotateCcw, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface RedoRequest {
  id: string;
  title: string;
  description: string;
  justification: string;
  priority: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  requested_by: string;
  reviewed_by: string | null;
  original_task_id?: string;
  requesterProfile?: { full_name: string; role: string };
  reviewerProfile?: { full_name: string };
}

interface RedoRequestsProps {
  onRefresh?: () => void;
}

export function RedoRequests({ onRefresh }: RedoRequestsProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RedoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ request: RedoRequest; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRedoRequests();
  }, []);

  const fetchRedoRequests = async () => {
    const { data, error } = await supabase
      .from('task_requests')
      .select(`
        *,
        requesterProfile:profiles!requested_by(full_name, role),
        reviewerProfile:profiles!reviewed_by(full_name)
      `)
      .eq('status', 'redo_pending')
      .order('requested_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleAction = async () => {
    if (!actionDialog || !userProfile) return;
    
    setSubmitting(true);
    const { request, action } = actionDialog;

    try {
      if (action === 'approve') {
        // Create new task for the student to redo
        const { error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: `[REDO] ${request.title}`,
            description: request.description,
            assigned_by: userProfile.user_id,
            assigned_to: request.requested_by,
            priority: request.priority as 'low' | 'medium' | 'high' | 'urgent',
            instructions: `Redo task: ${request.justification}`,
            status: 'pending',
          });

        if (taskError) throw taskError;

        // Update the request status
        const { error: updateError } = await supabase
          .from('task_requests')
          .update({
            status: 'redo_approved',
            reviewed_by: userProfile.user_id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        if (updateError) throw updateError;

        // Add comment if provided
        if (comment.trim()) {
          await supabase.from('task_comments').insert({
            task_id: request.id,
            user_id: userProfile.user_id,
            comment: `[REDO APPROVED] ${comment.trim()}`
          });
        }

        toast({
          title: "Redo Approved",
          description: "A new task has been created for the student to redo the work.",
        });
      } else {
        // Reject the redo request
        const { error } = await supabase
          .from('task_requests')
          .update({
            status: 'redo_rejected',
            reviewed_by: userProfile.user_id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        if (error) throw error;

        toast({
          title: "Redo Rejected",
          description: "The redo request has been rejected.",
        });
      }

      setActionDialog(null);
      setComment('');
      fetchRedoRequests();
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const priorityStyles = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      urgent: 'bg-destructive/10 text-destructive',
    };

    return (
      <Badge variant="outline" className={priorityStyles[priority as keyof typeof priorityStyles]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading redo requests...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          Redo Requests
        </h2>
        <Badge variant="secondary">{requests.length} pending</Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground">No redo requests pending</div>
            <p className="text-sm text-muted-foreground mt-2">
              Students can request to redo rejected tasks here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-amber-600" />
                      {request.title}
                    </CardTitle>
                    <CardDescription>{request.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(request.priority)}
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      REDO REQUEST
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {request.justification && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Reason for Redo:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                        {request.justification}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {request.requesterProfile?.full_name} 
                        <span className="text-muted-foreground ml-1">
                          ({request.requesterProfile?.role?.replace('_', ' ')})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>Requested: {format(new Date(request.requested_at), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      onClick={() => setActionDialog({ request, action: 'approve' })}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Redo
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActionDialog({ request, action: 'reject' })}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.action === 'approve' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Approve Redo Request
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-destructive" />
                  Reject Redo Request
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comment {actionDialog?.action === 'reject' && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                placeholder={
                  actionDialog?.action === 'approve'
                    ? "Add optional comment for the student..."
                    : "Please explain why this redo request is being rejected..."
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              {actionDialog?.action === 'reject' && !comment.trim() && (
                <p className="text-xs text-destructive">
                  A reason is required when rejecting a redo request
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setActionDialog(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={submitting || (actionDialog?.action === 'reject' && !comment.trim())}
              className={
                actionDialog?.action === 'approve'
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              {submitting ? "Processing..." : actionDialog?.action === 'approve' ? "Approve" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
