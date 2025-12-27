import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAITextAssist } from '@/hooks/useAITextAssist';
import { AITextButton } from '@/components/ui/ai-text-button';
import { SmartTextarea } from '@/components/ui/smart-textarea';
import { Send, Lightbulb, Clock, Sparkles } from 'lucide-react';

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string | null;
  estimated_hours: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements: string | null;
}

export function RequestTask() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    justification: '',
    priority: 'medium',
  });

  const { assistText: assistDescription, isLoading: descriptionLoading } = useAITextAssist({
    onSuccess: (text) => setFormData(prev => ({ ...prev, description: text })),
  });

  const { assistText: assistJustification, isLoading: justificationLoading } = useAITextAssist({
    onSuccess: (text) => setFormData(prev => ({ ...prev, justification: text })),
  });

  const aiLoading = descriptionLoading || justificationLoading;

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('active', true)
      .order('title');

    if (!error && data) {
      setTemplates(data);
    }
    setTemplatesLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setLoading(true);

    const requestData = {
      title: formData.title,
      description: formData.description,
      justification: formData.justification,
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      requested_by: userProfile.user_id,
    };

    const { error } = await supabase
      .from('task_requests')
      .insert(requestData);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Submitted",
        description: "Your task request has been sent to supervisors for review.",
      });
      
      setFormData({
        title: '',
        description: '',
        justification: '',
        priority: 'medium',
      });
    }

    setLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const useTemplate = (template: TaskTemplate) => {
    setFormData({
      title: template.title,
      description: template.description,
      justification: template.requirements || `I would like to work on ${template.title.toLowerCase()} as it aligns with my skills and the garden's needs.`,
      priority: template.priority,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleImproveDescription = () => {
    assistDescription(formData.description, 'improve', formData.title);
  };

  const handleExpandDescription = () => {
    assistDescription(formData.description, 'expand', formData.title);
  };

  const handleImproveJustification = () => {
    assistJustification(formData.justification, 'justification', formData.title);
  };

  const handleExpandJustification = () => {
    assistJustification(formData.justification, 'expand', formData.title);
  };

  return (
    <div className="space-y-6 mobile-optimized">
      {/* Available Templates */}
      {!templatesLoading && templates.length > 0 && (
        <Card className="fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Available Garden Tasks
            </CardTitle>
            <CardDescription>
              Choose from pre-defined tasks or create your own custom request
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mobile-grid">
              {templates.map((template) => (
                <Card key={template.id} className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => useTemplate(template)}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{template.title}</h4>
                        {template.category && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {template.category}
                          </Badge>
                        )}
                      </div>
                      <Badge className={`ml-2 text-xs ${getPriorityColor(template.priority)}`}>
                        {template.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    {template.estimated_hours && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {template.estimated_hours} hours
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Request Additional Task
            <Badge variant="secondary" className="ml-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Smart Compose
            </Badge>
          </CardTitle>
          <CardDescription>
            Submit a request for additional work. AI helps you write better descriptions as you type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Install new irrigation system"
                  required
                  disabled={aiLoading}
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Task Description *</Label>
                  <AITextButton
                    isLoading={descriptionLoading}
                    onImprove={handleImproveDescription}
                    onExpand={handleExpandDescription}
                    showDropdown
                  />
                </div>
                <SmartTextarea
                  id="description"
                  value={formData.description}
                  onChange={(value) => handleInputChange('description', value)}
                  placeholder="Describe the task you would like to work on... (AI suggests as you type, press Tab to accept)"
                  context="task request description"
                  rows={3}
                  disabled={descriptionLoading}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="justification">Justification *</Label>
                  <AITextButton
                    isLoading={justificationLoading}
                    onImprove={handleImproveJustification}
                    onExpand={handleExpandJustification}
                    showDropdown
                  />
                </div>
                <SmartTextarea
                  id="justification"
                  value={formData.justification}
                  onChange={(value) => handleInputChange('justification', value)}
                  placeholder="Explain why this task is needed... (AI suggests as you type, press Tab to accept)"
                  context="task justification"
                  rows={4}
                  disabled={justificationLoading}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="priority">Priority Level</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => handleInputChange('priority', value)}
                  disabled={aiLoading}
                >
                  <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading || aiLoading || !formData.title || !formData.description || !formData.justification}
              className="w-full gradient-green text-white hover:shadow-lg transition-all duration-200"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
