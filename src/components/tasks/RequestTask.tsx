import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, FileText } from 'lucide-react';

export function RequestTask() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    justification: '',
    priority: 'medium',
  });

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
      
      // Reset form
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Request Additional Task
          </CardTitle>
          <CardDescription>
            Submit a request for additional work or suggest a new task for the garden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Install new irrigation system"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Task Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the task you would like to work on..."
                required
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification *</Label>
              <Textarea
                id="justification"
                value={formData.justification}
                onChange={(e) => handleInputChange('justification', e.target.value)}
                placeholder="Explain why this task is needed and why you're suitable for it..."
                required
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
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

            <Button 
              type="submit" 
              disabled={loading || !formData.title || !formData.description || !formData.justification}
              className="w-full"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Request Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-foreground">When to request tasks:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>You've completed your assigned tasks and want more work</li>
                <li>You've identified an improvement opportunity in the garden</li>
                <li>You have specialized skills that could benefit a particular project</li>
                <li>You notice maintenance issues that need attention</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-foreground">Tips for good requests:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Be specific about what you want to do</li>
                <li>Explain the benefits to the garden</li>
                <li>Mention your relevant experience or interest</li>
                <li>Suggest a realistic timeframe</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}