import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star, User } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string;
  assignedToProfile?: { full_name: string };
}

interface Evaluation {
  id: string;
  score: number;
  feedback: string;
  created_at: string;
  task: { title: string };
  supervisor: { full_name: string };
}

interface PerformanceEvaluationProps {
  userRole: string;
}

export function PerformanceEvaluation({ userRole }: PerformanceEvaluationProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [score, setScore] = useState<number>(5);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      if (userRole === 'supervisor' || userRole === 'admin') {
        fetchCompletedTasks();
      } else {
        fetchMyEvaluations();
      }
    }
  }, [userProfile, userRole]);

  const fetchCompletedTasks = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignedToProfile:profiles!assigned_to(full_name)
      `)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setCompletedTasks(data);
    }
    setLoading(false);
  };

  const fetchMyEvaluations = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('performance_evaluations')
      .select('*')
      .eq('worker_id', userProfile.user_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Get task and supervisor information separately
      const evaluationsWithDetails = await Promise.all(
        data.map(async (evaluation) => {
          const [taskData, supervisorData] = await Promise.all([
            supabase.from('tasks').select('title').eq('id', evaluation.task_id).single(),
            supabase.from('profiles').select('full_name').eq('user_id', evaluation.supervisor_id).single()
          ]);
          
          return {
            ...evaluation,
            task: taskData.data || { title: 'Unknown Task' },
            supervisor: supervisorData.data || { full_name: 'Unknown Supervisor' }
          };
        })
      );
      setEvaluations(evaluationsWithDetails);
    }
    setLoading(false);
  };

  const submitEvaluation = async () => {
    if (!selectedTask || !userProfile) return;

    const task = completedTasks.find(t => t.id === selectedTask);
    if (!task) return;

    const { error } = await supabase
      .from('performance_evaluations')
      .insert({
        task_id: selectedTask,
        worker_id: task.assigned_to,
        supervisor_id: userProfile.user_id,
        score,
        feedback
      });

    if (!error) {
      toast({
        title: "Evaluation submitted",
        description: "Performance evaluation has been recorded."
      });
      setSelectedTask('');
      setScore(5);
      setFeedback('');
      fetchCompletedTasks();
    } else {
      toast({
        title: "Error",
        description: "Failed to submit evaluation.",
        variant: "destructive"
      });
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 10 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (userRole === 'supervisor' || userRole === 'admin') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Evaluate Task Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="task-select">Select Completed Task</Label>
              <select
                id="task-select"
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Choose a task...</option>
                {completedTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} - {task.assignedToProfile?.full_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTask && (
              <>
                <div>
                  <Label htmlFor="score">Performance Score (1-10)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="score"
                      type="number"
                      min="1"
                      max="10"
                      value={score}
                      onChange={(e) => setScore(Number(e.target.value))}
                      className="w-20"
                    />
                    <div className="flex">{renderStars(score)}</div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="feedback">Feedback</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide detailed feedback on performance..."
                    rows={4}
                  />
                </div>

                <Button onClick={submitEvaluation}>
                  Submit Evaluation
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Worker view - show their evaluations
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          My Performance Evaluations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {evaluations.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            No evaluations yet
          </div>
        ) : (
          <div className="space-y-4">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{evaluation.task.title}</h4>
                  <Badge variant="outline">
                    {evaluation.score}/10
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(evaluation.score)}
                </div>
                {evaluation.feedback && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {evaluation.feedback}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>Evaluated by {evaluation.supervisor.full_name}</span>
                  <span>•</span>
                  <span>
                    {format(new Date(evaluation.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}