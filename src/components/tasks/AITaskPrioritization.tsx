import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, Loader2, RefreshCw, ArrowUp, Clock, 
  MapPin, User, AlertTriangle, Lightbulb 
} from 'lucide-react';
import { useAITaskPrioritization } from '@/hooks/useAITaskPrioritization';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AITaskPrioritizationProps {
  userId?: string;
  onTaskSelect?: (taskId: string) => void;
}

export function AITaskPrioritization({ userId, onTaskSelect }: AITaskPrioritizationProps) {
  const { prioritization, isLoading, fetchPrioritization } = useAITaskPrioritization();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Task Prioritization</CardTitle>
              <CardDescription>
                Smart task ordering based on urgency, deadlines, and efficiency
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchPrioritization(userId)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Prioritize Tasks
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !prioritization && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">AI is analyzing task priorities...</p>
          </div>
        )}

        {!isLoading && !prioritization && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Prioritize Tasks" to get AI-powered task ordering</p>
          </div>
        )}

        {prioritization && (
          <div className="space-y-4">
            {/* Overdue Warning */}
            {prioritization.overdueTasks && prioritization.overdueTasks.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-red-700 font-medium">
                  {prioritization.overdueTasks.length} overdue task(s) need immediate attention
                </span>
              </div>
            )}

            {/* Prioritized Tasks */}
            {prioritization.prioritizedTasks && prioritization.prioritizedTasks.length > 0 ? (
              <div className="space-y-3">
                {prioritization.prioritizedTasks.map((item) => (
                  <div 
                    key={item.taskId}
                    className={cn(
                      "p-4 border rounded-lg transition-all hover:shadow-md cursor-pointer",
                      item.rank === 1 && "ring-2 ring-primary/30 bg-primary/5"
                    )}
                    onClick={() => onTaskSelect?.(item.taskId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center justify-center h-8 w-8 rounded-full text-white font-bold text-sm",
                          item.rank === 1 ? "bg-primary" : 
                          item.rank <= 3 ? "bg-orange-500" : "bg-muted-foreground"
                        )}>
                          {item.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{item.task?.title}</span>
                            {item.task?.due_date && isOverdue(item.task.due_date) && (
                              <Badge variant="destructive" className="text-xs">Overdue</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={cn("text-xs", getPriorityColor(item.suggestedPriority))}>
                          {item.suggestedPriority}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <ArrowUp className="h-3 w-3" />
                          <div className={cn("h-2 w-12 rounded-full", getUrgencyColor(item.urgencyScore))} 
                               style={{ opacity: item.urgencyScore / 100 }} />
                          <span className="text-xs text-muted-foreground">{item.urgencyScore}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      {item.task?.workerName && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.task.workerName}
                        </div>
                      )}
                      {item.task?.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.task.due_date), 'MMM d')}
                        </div>
                      )}
                      {item.task?.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.task.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                {prioritization.message || 'No tasks to prioritize'}
              </div>
            )}

            {/* AI Recommendations */}
            {prioritization.recommendations && prioritization.recommendations.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">AI Recommendations</span>
                </div>
                <ul className="space-y-1">
                  {prioritization.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
