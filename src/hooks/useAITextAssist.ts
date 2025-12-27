import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AssistType = 'improve' | 'expand' | 'report' | 'justification' | 'suggest';

interface UseAITextAssistOptions {
  onSuccess?: (improvedText: string) => void;
}

export function useAITextAssist(options?: UseAITextAssistOptions) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const assistText = useCallback(async (
    text: string,
    type: AssistType = 'improve',
    context?: string
  ): Promise<string | null> => {
    if (!text.trim()) {
      toast({
        title: "No text provided",
        description: "Please enter some text first.",
        variant: "destructive",
      });
      return null;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-text-assist', {
        body: { text, type, context },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast({
          title: "AI Assistance Error",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      const improvedText = data?.improvedText;
      
      if (improvedText && options?.onSuccess) {
        options.onSuccess(improvedText);
      }

      toast({
        title: "Text Improved",
        description: "AI has enhanced your text.",
      });

      return improvedText;
    } catch (error) {
      console.error('AI assist error:', error);
      toast({
        title: "AI Assistance Failed",
        description: "Unable to improve text. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast, options]);

  return {
    assistText,
    isLoading,
  };
}
