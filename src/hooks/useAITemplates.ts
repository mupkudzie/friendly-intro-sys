import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AITemplate {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  estimated_hours: number;
  requirements: string;
}

export function useAITemplates() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedTemplates, setSuggestedTemplates] = useState<AITemplate[]>([]);

  const generateTemplates = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-templates', {
        body: {},
      });

      if (error) throw error;

      const templates = data?.templates || [];
      setSuggestedTemplates(templates);

      if (templates.length > 0) {
        toast({
          title: "AI Templates Generated",
          description: `Created ${templates.length} template suggestion${templates.length > 1 ? 's' : ''} based on past tasks.`,
        });
      } else {
        toast({
          title: "No New Templates",
          description: data?.message || "AI couldn't find new patterns to suggest.",
        });
      }

      return templates;
    } catch (error) {
      console.error('Template generation error:', error);
      toast({
        title: "Template Generation Failed",
        description: "Unable to generate AI templates. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveTemplate = useCallback(async (template: AITemplate, userId: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .insert({
          title: template.title,
          description: template.description,
          category: template.category,
          priority: template.priority,
          estimated_hours: template.estimated_hours,
          requirements: template.requirements,
          created_by: userId,
          active: true,
        });

      if (error) throw error;

      toast({
        title: "Template Saved",
        description: `"${template.title}" has been added to your templates.`,
      });

      // Remove from suggestions
      setSuggestedTemplates(prev => prev.filter(t => t.title !== template.title));

      return true;
    } catch (error) {
      console.error('Save template error:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save template. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const dismissTemplate = useCallback((title: string) => {
    setSuggestedTemplates(prev => prev.filter(t => t.title !== title));
  }, []);

  return {
    suggestedTemplates,
    isLoading,
    generateTemplates,
    saveTemplate,
    dismissTemplate,
  };
}
