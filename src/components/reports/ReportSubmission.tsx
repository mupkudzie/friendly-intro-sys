import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, FileText } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
}

export function ReportSubmission() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCompletedTasks();
  }, [userProfile]);

  const fetchCompletedTasks = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userProfile.user_id)
      .in('status', ['completed', 'approved'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCompletedTasks(data);
    }
  };

  const submitReport = async () => {
    if (!selectedTaskId || !report.trim() || !userProfile) return;

    setLoading(true);

    const { error } = await supabase
      .from('task_reports')
      .insert({
        task_id: selectedTaskId,
        user_id: userProfile.user_id,
        original_report: report.trim(),
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Report Submitted",
        description: "Your task report has been submitted for review.",
      });
      setSelectedTaskId('');
      setReport('');
      fetchCompletedTasks();
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Submit Task Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="task-select" className="text-sm font-medium">
                Select Completed Task
              </label>
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a completed task" />
                </SelectTrigger>
                <SelectContent>
                  {completedTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground">{task.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="report" className="text-sm font-medium">
                Work Report
              </label>
              <Textarea
                id="report"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder="Describe what you accomplished, any challenges faced, and the current status..."
                rows={6}
              />
            </div>

            <Button 
              onClick={submitReport}
              disabled={!selectedTaskId || !report.trim() || loading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}