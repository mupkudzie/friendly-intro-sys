import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Star, TrendingUp, Award, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Evaluation {
  id: string;
  task_id: string;
  score: number;
  feedback: string;
  created_at: string;
  supervisor_id: string;
  task?: {
    title: string;
    description: string;
  };
  supervisor?: {
    full_name: string;
  };
}

interface Worker {
  user_id: string;
  full_name: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string;
}

interface PerformanceEvaluationProps {
  userRole: string;
}

export function PerformanceEvaluation({ userRole }: PerformanceEvaluationProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    worker_id: '',
    task_id: '',
    score: '5',
    feedback: '',
  });

  useEffect(() => {
    if (userRole === 'supervisor' || userRole === 'admin') {
      fetchWorkersAndTasks();
    }
    fetchEvaluations();
  }, [userRole, userProfile]);

  const fetchWorkersAndTasks = async () => {
    const { data: workersData } = await supabase
      .from('profiles')
      .select('user_id, full_name, role')
      .in('role', ['student', 'garden_worker'])
      .eq('approval_status', 'approved');

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_to')
      .eq('status', 'approved');

    if (workersData) setWorkers(workersData);
    if (tasksData) setCompletedTasks(tasksData);
  };

  const fetchEvaluations = async () => {
    if (!userProfile) return;

    let query = supabase
      .from('performance_evaluations')
      .select('*')
      .order('created_at', { ascending: false });

    if (userRole === 'student' || userRole === 'garden_worker') {
      query = query.eq('worker_id', userProfile.user_id);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch related data separately
      const evaluationsWithDetails = await Promise.all(
        data.map(async (evaluation) => {
          const [taskData, supervisorData] = await Promise.all([
            supabase.from('tasks').select('title, description').eq('id', evaluation.task_id).single(),
            supabase.from('profiles').select('full_name').eq('user_id', evaluation.supervisor_id).single()
          ]);
          
          return {
            ...evaluation,
            task: taskData.data || { title: 'Unknown Task', description: '' },
            supervisor: supervisorData.data || { full_name: 'Unknown Supervisor' }
          };
        })
      );
      setEvaluations(evaluationsWithDetails);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const evaluationData = {
      worker_id: formData.worker_id,
      task_id: formData.task_id,
      supervisor_id: userProfile.user_id,
      score: parseInt(formData.score),
      feedback: formData.feedback,
    };

    const { error } = await supabase
      .from('performance_evaluations')
      .insert(evaluationData);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Evaluation Submitted",
        description: "Performance evaluation has been recorded successfully.",
      });
      setIsDialogOpen(false);
      setFormData({
        worker_id: '',
        task_id: '',
        score: '5',
        feedback: '',
      });
      fetchEvaluations();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const averageScore = evaluations.length > 0
    ? (evaluations.reduce((acc, ev) => acc + ev.score, 0) / evaluations.length).toFixed(1)
    : '0.0';


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="fade-in">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Performance Tracking
              </CardTitle>
              <CardDescription>
                {userRole === 'supervisor' || userRole === 'admin'
                  ? 'Evaluate and track worker performance across tasks'
                  : 'View your performance evaluations and feedback'}
              </CardDescription>
            </div>
            {(userRole === 'supervisor' || userRole === 'admin') && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-green text-white">
                    <Star className="w-4 h-4 mr-2" />
                    New Evaluation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create Performance Evaluation</DialogTitle>
                    <DialogDescription>
                      Evaluate a worker's performance on a completed task
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="worker_id">Worker *</Label>
                      <Select 
                        value={formData.worker_id} 
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, worker_id: value, task_id: '' }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select worker" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map((worker) => (
                            <SelectItem key={worker.user_id} value={worker.user_id}>
                              {worker.full_name} ({worker.role.replace('_', ' ')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="task_id">Task *</Label>
                      <Select 
                        value={formData.task_id} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, task_id: value }))}
                        disabled={!formData.worker_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select completed task" />
                        </SelectTrigger>
                        <SelectContent>
                          {completedTasks
                            .filter(task => task.assigned_to === formData.worker_id)
                            .map((task) => (
                              <SelectItem key={task.id} value={task.id}>
                                {task.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="score">Performance Score (1-10) *</Label>
                      <Select 
                        value={formData.score} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, score: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {num >= 8 ? '⭐ Excellent' : num >= 6 ? '👍 Good' : '⚠️ Needs Improvement'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="feedback">Feedback *</Label>
                      <Textarea
                        id="feedback"
                        value={formData.feedback}
                        onChange={(e) => setFormData(prev => ({ ...prev, feedback: e.target.value }))}
                        placeholder="Provide constructive feedback on the worker's performance..."
                        required
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={!formData.worker_id || !formData.task_id || !formData.feedback}
                        className="flex-1 gradient-green text-white"
                      >
                        Submit Evaluation
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Performance Summary */}
      {evaluations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{evaluations.length}</div>
            </CardContent>
          </Card>
          <Card className="slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold text-green-600">{averageScore}</div>
                <Award className="w-6 h-6 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Performance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getScoreColor(parseFloat(averageScore))}>
                {parseFloat(averageScore) >= 8 ? 'Excellent' : parseFloat(averageScore) >= 6 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evaluations List */}
      {evaluations.length === 0 ? (
        <Card className="slide-up">
          <CardContent className="text-center py-12">
            <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No evaluations yet</h3>
            <p className="text-muted-foreground">
              {userRole === 'supervisor' || userRole === 'admin'
                ? 'Start evaluating worker performance on completed tasks'
                : 'Your supervisors will evaluate your performance after task completion'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {evaluations.map((evaluation) => (
            <Card key={evaluation.id} className="slide-up hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{evaluation.task?.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {new Date(evaluation.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getScoreColor(evaluation.score)}>
                      Score: {evaluation.score}/10
                    </Badge>
                    {evaluation.supervisor && (
                      <span className="text-xs text-muted-foreground">
                        by {evaluation.supervisor.full_name}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2 bg-muted p-4 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium mb-1">Feedback:</h4>
                    <p className="text-sm text-muted-foreground">{evaluation.feedback}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}