import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PrioritizedTask {
  taskId: string;
  rank: number;
  suggestedPriority: 'urgent' | 'high' | 'medium' | 'low';
  reason: string;
  urgencyScore: number;
  task: {
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    due_date: string | null;
    estimated_hours: number | null;
    location: string | null;
    assigned_to: string;
    workerName: string;
  } | null;
}

export interface TaskPrioritization {
  prioritizedTasks: PrioritizedTask[];
  groupedByLocation?: Record<string, string[]>;
  overdueTasks?: string[];
  recommendations?: string[];
  message?: string;
}

export function useAITaskPrioritization() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [prioritization, setPrioritization] = useState<TaskPrioritization | null>(null);

  const fetchPrioritization = useCallback(async (userId?: string) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-task-prioritization', {
        body: { userId },
      });

      if (error) throw error;

      setPrioritization(data);

      if (data.prioritizedTasks?.length > 0) {
        toast({
          title: "Tasks Prioritized",
          description: `AI has analyzed ${data.prioritizedTasks.length} tasks.`,
        });
      }

      return data;
    } catch (error) {
      console.error('Task prioritization error:', error);
      toast({
        title: "Prioritization Failed",
        description: "Unable to prioritize tasks. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearPrioritization = useCallback(() => {
    setPrioritization(null);
  }, []);

  return {
    prioritization,
    isLoading,
    fetchPrioritization,
    clearPrioritization,
  };
}
