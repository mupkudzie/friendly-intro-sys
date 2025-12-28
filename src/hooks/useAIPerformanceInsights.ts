import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Insight {
  type: 'positive' | 'warning' | 'critical';
  title: string;
  description: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
}

interface TopPerformer {
  name: string;
  achievement: string;
}

interface NeedsAttention {
  name: string;
  issue: string;
  suggestion: string;
}

interface WorkerStat {
  name: string;
  department: string;
  completedTasks: number;
  pendingTasks: number;
  totalHours: number;
  avgScore: number;
  completionRate: number | string;
}

interface WeeklyData {
  week: string;
  tasks: number;
  hours: number;
}

interface RawStats {
  workerStats: WorkerStat[];
  totalCompleted: number;
  totalPending: number;
  totalInProgress: number;
  totalHours: number;
  avgPerformance: number;
  weeklyData: WeeklyData[];
}

export interface PerformanceInsights {
  overallHealthScore: number;
  productivityTrend: 'increasing' | 'stable' | 'decreasing';
  keyInsights: Insight[];
  recommendations: Recommendation[];
  topPerformers: TopPerformer[];
  needsAttention: NeedsAttention[];
  weeklyForecast: string;
  rawStats?: RawStats;
}

export function useAIPerformanceInsights() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-performance-insights', {
        body: {},
      });

      if (error) throw error;

      setInsights(data);

      toast({
        title: "AI Analysis Complete",
        description: "Performance insights have been generated.",
      });

      return data;
    } catch (error) {
      console.error('Performance insights error:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to generate AI insights. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    insights,
    isLoading,
    fetchInsights,
  };
}
