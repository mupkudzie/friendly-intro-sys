import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, X, Clock, User, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface TaskRequest {
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
  requesterProfile?: { full_name: string; role: string };
  reviewerProfile?: { full_name: string };
}

export function TaskRequests() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('task_requests')
      .select(`
        *,
        requesterProfile:profiles!requested_by(full_name, role),
        reviewerProfile:profiles!reviewed_by(full_name)
      `)
      .order('requested_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    if (!userProfile) return;

    const { error } = await supabase
      .from('task_requests')
      .update({
        status: action,
        reviewed_by: userProfile.user_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Request ${action} successfully!`,
      });
      fetchRequests();
    }
  };

  const createTaskFromRequest = async (request: TaskRequest) => {
    if (!userProfile) return;

    // Create a new task based on the request
    const { error } = await supabase
      .from('tasks')
      .insert({
        title: request.title,
        description: request.description,
        assigned_by: userProfile.user_id,
        assigned_to: request.requested_by,
        priority: request.priority as 'low' | 'medium' | 'high' | 'urgent',
        instructions: `Created from task request: ${request.justification}`,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Mark request as approved and update it
      await handleRequestAction(request.id, 'approved');
      toast({
        title: "Task Created",
        description: "Task has been created and assigned to the requester!",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityStyles = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
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
          <div className="text-center">Loading task requests...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Requests</h2>
        <Badge variant="secondary">{requests.length} requests</Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground">No task requests found</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {request.title}
                    </CardTitle>
                    <CardDescription>{request.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(request.priority)}
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {request.justification && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Justification:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                        {request.justification}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                    {request.reviewed_at && request.reviewerProfile && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span>Reviewed by: {request.reviewerProfile.full_name}</span>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => createTaskFromRequest(request)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve & Create Task
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRequestAction(request.id, 'rejected')}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}