import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSmartComposeOptions {
  debounceMs?: number;
  minChars?: number;
  context?: string;
}

export function useSmartCompose(options: UseSmartComposeOptions = {}) {
  const { debounceMs = 500, minChars = 15, context = '' } = options;
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getSuggestion = useCallback(async (text: string) => {
    if (text.length < minChars) {
      setSuggestion('');
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-text-assist', {
        body: { 
          text, 
          type: 'suggest',
          context: context || 'farm/garden work description'
        },
      });

      if (error) throw error;

      if (data?.improvedText) {
        // Only show suggestion if it starts with the user's text or is a continuation
        const improvedText = data.improvedText;
        setSuggestion(improvedText);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Smart compose error:', error);
      }
      setSuggestion('');
    } finally {
      setIsLoading(false);
    }
  }, [minChars, context]);

  const debouncedGetSuggestion = useCallback((text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      getSuggestion(text);
    }, debounceMs);
  }, [getSuggestion, debounceMs]);

  const acceptSuggestion = useCallback(() => {
    const accepted = suggestion;
    setSuggestion('');
    return accepted;
  }, [suggestion]);

  const clearSuggestion = useCallback(() => {
    setSuggestion('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestion,
    isLoading,
    getSuggestion: debouncedGetSuggestion,
    acceptSuggestion,
    clearSuggestion,
  };
}
