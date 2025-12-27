import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAITextAssist } from '@/hooks/useAITextAssist';
import { AITextButton } from '@/components/ui/ai-text-button';
import { SmartTextarea } from '@/components/ui/smart-textarea';
import { Send, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  const selectedTask = completedTasks.find(t => t.id === selectedTaskId);

  const { assistText, isLoading: aiLoading } = useAITextAssist({
    onSuccess: (improvedText) => setReport(improvedText),
  });

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

  const handleAIImprove = () => {
    assistText(report, 'report', selectedTask?.title);
  };

  const handleAIExpand = () => {
    assistText(report, 'expand', selectedTask?.title);
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
            <Badge variant="secondary" className="ml-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Smart Compose
            </Badge>
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
              <div className="flex items-center justify-between">
                <label htmlFor="report" className="text-sm font-medium">
                  Work Report
                </label>
                <AITextButton
                  isLoading={aiLoading}
                  onImprove={handleAIImprove}
                  onExpand={handleAIExpand}
                  showDropdown
                />
              </div>
              <SmartTextarea
                id="report"
                value={report}
                onChange={setReport}
                placeholder="Describe what you accomplished... (AI suggests as you type, press Tab to accept)"
                context="task completion report"
                rows={6}
                disabled={aiLoading}
              />
              <p className="text-xs text-muted-foreground">
                Tip: Start typing and AI will suggest completions. Press Tab to accept or Esc to dismiss.
              </p>
            </div>

            <Button 
              onClick={submitReport}
              disabled={!selectedTaskId || !report.trim() || loading || aiLoading}
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
