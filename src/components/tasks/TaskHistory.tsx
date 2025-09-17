import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, User, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface TaskHistoryEntry {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string;
  created_at: string;
  user_id: string;
  userProfile?: { full_name: string } | null;
}

interface TaskHistoryProps {
  taskId: string;
}

export function TaskHistory({ taskId }: TaskHistoryProps) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskHistory();
  }, [taskId]);

  const fetchTaskHistory = async () => {
    const { data, error } = await supabase
      .from('task_history')
      .select(`
        *,
        userProfile:profiles!user_id(full_name)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setHistory(data as any);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status?.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading task history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Task History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No history available</p>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{entry.userProfile?.full_name || 'System'}</span>
                    <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{entry.action}</p>
                  <div className="flex items-center gap-2">
                    {entry.old_status && (
                      <>
                        {getStatusBadge(entry.old_status)}
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    {getStatusBadge(entry.new_status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}