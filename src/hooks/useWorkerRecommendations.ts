import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkerRecommendation {
  user_id: string;
  full_name: string;
  reason: string;
  score: number;
}

export function useWorkerRecommendations() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<WorkerRecommendation[]>([]);

  const getRecommendations = useCallback(async (
    taskTitle: string,
    taskDescription: string,
    taskPriority: string
  ) => {
    if (!taskTitle.trim() || !taskDescription.trim()) {
      return [];
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-worker-recommend', {
        body: { taskTitle, taskDescription, taskPriority },
      });

      if (error) throw error;

      const recs = data?.recommendations || [];
      setRecommendations(recs);

      if (recs.length > 0) {
        toast({
          title: "AI Recommendations Ready",
          description: `Found ${recs.length} recommended worker${recs.length > 1 ? 's' : ''} for this task.`,
        });
      }

      return recs;
    } catch (error) {
      console.error('Worker recommendation error:', error);
      toast({
        title: "Recommendation Failed",
        description: "Unable to get AI recommendations. You can still assign manually.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  return {
    recommendations,
    isLoading,
    getRecommendations,
    clearRecommendations,
  };
}
