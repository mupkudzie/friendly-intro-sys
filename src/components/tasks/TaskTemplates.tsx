import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAITemplates } from '@/hooks/useAITemplates';
import { AITemplatesSuggestions } from '@/components/tasks/AITemplatesSuggestions';
import { Plus, Edit2, Archive, Trash2, FileText, Clock, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string | null;
  estimated_hours: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements: string | null;
  active: boolean;
  created_at: string;
}

export function TaskTemplates() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    estimated_hours: '',
    priority: 'medium',
    requirements: '',
  });

  const {
    suggestedTemplates,
    isLoading: aiLoading,
    generateTemplates,
    saveTemplate,
    dismissTemplate,
  } = useAITemplates();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const templateData = {
      title: formData.title,
      description: formData.description,
      category: formData.category || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      requirements: formData.requirements || null,
      created_by: userProfile.user_id,
    };

    let error;
    if (editingTemplate) {
      ({ error } = await supabase
        .from('task_templates')
        .update(templateData)
        .eq('id', editingTemplate.id));
    } else {
      ({ error } = await supabase
        .from('task_templates')
        .insert(templateData));
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: editingTemplate ? "Template Updated" : "Template Created",
        description: `Task template "${formData.title}" has been ${editingTemplate ? 'updated' : 'created'} successfully.`,
      });
      resetForm();
      setIsDialogOpen(false);
      fetchTemplates();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      estimated_hours: '',
      priority: 'medium',
      requirements: '',
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description,
      category: template.category || '',
      estimated_hours: template.estimated_hours?.toString() || '',
      priority: template.priority,
      requirements: template.requirements || '',
    });
    setIsDialogOpen(true);
  };

  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const handleArchive = async (templateId: string) => {
    const { error } = await supabase
      .from('task_templates')
      .update({ active: false })
      .eq('id', templateId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Template Archived",
        description: "The task template has been archived.",
      });
      fetchTemplates();
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Template Deleted",
        description: "The task template has been permanently deleted.",
      });
      fetchTemplates();
    }
    setDeleteTemplateId(null);
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

  const categories = ['Planting', 'Maintenance', 'Watering', 'Pest Control', 'Harvesting', 'Tools & Equipment', 'Infrastructure'];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading templates...</div>
        </CardContent>
      </Card>
    );
  }

  const handleUseAITemplate = (template: { title: string; description: string; category: string; priority: 'low' | 'medium' | 'high'; estimated_hours: number; requirements: string }) => {
    setFormData({
      title: template.title,
      description: template.description,
      category: template.category,
      estimated_hours: template.estimated_hours?.toString() || '',
      priority: template.priority,
      requirements: template.requirements || '',
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* AI-Generated Templates Section */}
      <AITemplatesSuggestions
        templates={suggestedTemplates}
        isLoading={aiLoading}
        onGenerate={generateTemplates}
        onSave={(template) => userProfile && saveTemplate(template, userProfile.user_id)}
        onDismiss={dismissTemplate}
        onUseTemplate={handleUseAITemplate}
      />

      <Card className="fade-in">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Garden Task Templates
              </CardTitle>
              <CardDescription>
                Create and manage reusable task templates for efficient garden management
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="gradient-green text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Edit Task Template' : 'Create New Task Template'}
                  </DialogTitle>
                  <DialogDescription>
                    Define a reusable task template that can be used for task assignments
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="title">Template Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Weekly Garden Maintenance"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="estimated_hours">Estimated Hours</Label>
                      <Input
                        id="estimated_hours"
                        type="number"
                        step="0.5"
                        value={formData.estimated_hours}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                        placeholder="e.g., 2.5"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Detailed description of the task..."
                        required
                        rows={3}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="requirements">Requirements</Label>
                      <Textarea
                        id="requirements"
                        value={formData.requirements}
                        onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                        placeholder="Tools, skills, or materials needed..."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!formData.title || !formData.description} className="flex-1 gradient-green text-white">
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {templates.length === 0 ? (
        <Card className="slide-up">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first task template to streamline garden work assignments
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gradient-green text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mobile-grid">
          {templates.map((template) => (
            <Card key={template.id} className="mobile-card slide-up hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{template.title}</h3>
                    {template.category && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  <Badge className={`ml-2 text-xs ${getPriorityColor(template.priority)}`}>
                    {template.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {template.description}
                </p>
                
                {template.estimated_hours && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <Clock className="w-3 h-3" />
                    {template.estimated_hours} hours
                  </div>
                )}

                {template.requirements && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground mb-3">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-1">{template.requirements}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(template)}
                    className="flex-1"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleArchive(template.id)}
                    className="flex-1"
                  >
                    <Archive className="w-3 h-3 mr-1" />
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTemplateId(template.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && handleDeleteTemplate(deleteTemplateId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}