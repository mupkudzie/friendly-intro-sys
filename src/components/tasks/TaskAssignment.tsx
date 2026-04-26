import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAITextAssist } from '@/hooks/useAITextAssist';
import { useWorkerRecommendations } from '@/hooks/useWorkerRecommendations';
import { AITextButton } from '@/components/ui/ai-text-button';
import { SmartTextarea } from '@/components/ui/smart-textarea';
import { WorkerRecommendations } from '@/components/tasks/WorkerRecommendations';
import { Plus, User, MapPin, Sparkles, Loader2, FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string | null;
  estimated_hours: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  student_id: string | null;
  department: string | null;
}

export function TaskAssignment() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: '8',
    location: '',
    instructions: '',
    geofence_lat: '',
    geofence_lon: '',
    geofence_radius: '100',
    gps_required: true,
    location_type: 'garden_coordinates' as 'garden_coordinates' | 'current_location',
  });
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const { assistText: assistDescription, isLoading: descriptionLoading } = useAITextAssist({
    onSuccess: (text) => setFormData(prev => ({ ...prev, description: text })),
  });

  const { assistText: assistInstructions, isLoading: instructionsLoading } = useAITextAssist({
    onSuccess: (text) => setFormData(prev => ({ ...prev, instructions: text })),
  });

  const {
    recommendations,
    isLoading: recommendationsLoading,
    getRecommendations,
    clearRecommendations,
  } = useWorkerRecommendations();

  const aiLoading = descriptionLoading || instructionsLoading || aiSuggestLoading || recommendationsLoading;

  useEffect(() => {
    fetchWorkers();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('active', true)
      .order('title');
    if (!error && data) setTemplates(data);
    setTemplatesLoading(false);
  };

  const fetchWorkers = async () => {
    // Fetch all farm workers
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['student', 'garden_worker'])
      .eq('is_deleted', false)
      .order('full_name');

    if (!error && data) {
      setWorkers(data);
    }
  };

  const handleAISuggestTask = async () => {
    if (!formData.title) {
      toast({
        title: "Title Required",
        description: "Please enter a task title first.",
        variant: "destructive",
      });
      return;
    }

    setAiSuggestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-text-assist', {
        body: {
          text: formData.title,
          type: 'expand',
          context: `Generate a detailed task description for a farm task titled "${formData.title}". Include what needs to be done, tools required, and expected outcomes.`
        },
      });

      if (error) throw error;

      if (data?.improvedText) {
        setFormData(prev => ({ ...prev, description: data.improvedText }));
        toast({
          title: "AI Suggestion Applied",
          description: "Task description has been generated.",
        });
      }
    } catch (error) {
      console.error('AI suggest error:', error);
      toast({
        title: "AI Suggestion Failed",
        description: "Unable to generate suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleAISuggestInstructions = async () => {
    if (!formData.title || !formData.description) {
      toast({
        title: "More Info Required",
        description: "Please enter a task title and description first.",
        variant: "destructive",
      });
      return;
    }

    setAiSuggestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-text-assist', {
        body: {
          text: `Task: ${formData.title}\nDescription: ${formData.description}`,
          type: 'expand',
          context: 'Generate clear step-by-step instructions for completing this farm task. Include safety tips if relevant.'
        },
      });

      if (error) throw error;

      if (data?.improvedText) {
        setFormData(prev => ({ ...prev, instructions: data.improvedText }));
        toast({
          title: "Instructions Generated",
          description: "AI has generated task instructions.",
        });
      }
    } catch (error) {
      console.error('AI suggest error:', error);
      toast({
        title: "AI Suggestion Failed",
        description: "Unable to generate instructions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setLoading(true);

    const gpsEnabled = formData.gps_required;
    const isGardenLocation = gpsEnabled && formData.location_type === 'garden_coordinates';
    const taskData = {
      title: formData.title,
      description: formData.description,
      assigned_to: formData.assigned_to,
      assigned_by: userProfile.user_id,
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      due_date: formData.due_date || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : 8,
      location: formData.location || null,
      instructions: formData.instructions || null,
      location_type: gpsEnabled ? formData.location_type : 'current_location',
      geofence_lat: isGardenLocation && formData.geofence_lat ? parseFloat(formData.geofence_lat) : null,
      geofence_lon: isGardenLocation && formData.geofence_lon ? parseFloat(formData.geofence_lon) : null,
      geofence_radius: isGardenLocation && formData.geofence_radius ? parseFloat(formData.geofence_radius) : 100,
    };

    const { error } = await supabase
      .from('tasks')
      .insert(taskData);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Auto-save as template if not already existing (case-insensitive title match)
      try {
        const { data: existingTemplate } = await supabase
          .from('task_templates')
          .select('id')
          .ilike('title', formData.title.trim())
          .eq('active', true)
          .maybeSingle();

        if (!existingTemplate) {
          await supabase.from('task_templates').insert({
            title: formData.title.trim(),
            description: formData.description,
            priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
            estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : 8,
            requirements: formData.instructions || null,
            category: formData.location || null,
            created_by: userProfile.user_id,
            active: true,
          });
          fetchTemplates();
        }
      } catch (tplErr) {
        console.warn('Template auto-save skipped:', tplErr);
      }

      toast({
        title: "Success",
        description: "Task assigned successfully! Saved as template for future use.",
      });
      
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        due_date: '',
        estimated_hours: '8',
        location: '',
        instructions: '',
        geofence_lat: '',
        geofence_lon: '',
        geofence_radius: '100',
        gps_required: true,
        location_type: 'garden_coordinates',
      });
    }

    setLoading(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUseCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      setFormData(prev => ({
        ...prev,
        geofence_lat: position.coords.latitude.toString(),
        geofence_lon: position.coords.longitude.toString(),
      }));

      toast({
        title: "Location captured",
        description: `Lat: ${position.coords.latitude.toFixed(6)}, Lon: ${position.coords.longitude.toFixed(6)}`,
      });
    } catch (error) {
      toast({
        title: "Location error",
        description: "Failed to get current location. Please enable GPS.",
        variant: "destructive",
      });
    }
  };

  const handleUseGardenLocation = () => {
    setFormData(prev => ({
      ...prev,
      geofence_lat: '-20.164235',
      geofence_lon: '28.641425',
      location: 'Bulawayo North Farm',
    }));

    toast({
      title: "Farm location set",
      description: "Bulawayo North Farm (-20.164235, 28.641425)",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Assign New Task
            <Badge variant="secondary" className="ml-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Powered
            </Badge>
          </CardTitle>
          <CardDescription>
            Create and assign tasks with AI assistance for descriptions and instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Water the vegetable farm"
                  required
                  disabled={aiLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select 
                  value={formData.assigned_to} 
                  onValueChange={(value) => {
                    handleInputChange('assigned_to', value);
                    clearRecommendations();
                  }}
                  disabled={aiLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.user_id} value={worker.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                        {worker.full_name}
                          <span className="text-muted-foreground">
                            (Farm Worker)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Worker Recommendations */}
            <WorkerRecommendations
              recommendations={recommendations}
              isLoading={recommendationsLoading}
              onSelectWorker={(userId) => {
                handleInputChange('assigned_to', userId);
                clearRecommendations();
              }}
              onGetRecommendations={() => 
                getRecommendations(formData.title, formData.description, formData.priority)
              }
              disabled={!formData.title || !formData.description}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description *</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAISuggestTask}
                    disabled={aiLoading || !formData.title}
                    className="text-xs"
                  >
                    {aiSuggestLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    Generate with AI
                  </Button>
                  <AITextButton
                    isLoading={descriptionLoading}
                    onImprove={() => assistDescription(formData.description, 'improve', formData.title)}
                  />
                </div>
              </div>
              <SmartTextarea
                id="description"
                value={formData.description}
                onChange={(value) => handleInputChange('description', value)}
                placeholder="Describe what needs to be done... (AI will suggest as you type)"
                context="farm task description"
                rows={3}
                disabled={descriptionLoading || aiSuggestLoading}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => handleInputChange('priority', value)}
                  disabled={aiLoading}
                >
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
              
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  disabled={aiLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Estimated Hours</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
                  placeholder="e.g., 2.5"
                  disabled={aiLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., Greenhouse A, Main Farm, Nursery"
                disabled={aiLoading}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="gps_required" className="text-base font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    GPS Tracking
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.gps_required
                      ? 'Worker must verify their location. 3 random GPS check-ins will appear during the task.'
                      : 'No GPS verification required. Worker can complete the task from anywhere.'}
                  </p>
                </div>
                <Switch
                  id="gps_required"
                  checked={formData.gps_required}
                  onCheckedChange={(checked) => handleInputChange('gps_required', checked)}
                  disabled={aiLoading}
                />
              </div>

              {formData.gps_required && (
                <>
                  <div className="space-y-2">
                    <Label>Location Source *</Label>
                    <Select
                      value={formData.location_type}
                      onValueChange={(value) => {
                        handleInputChange('location_type', value);
                        if (value === 'current_location') {
                          setFormData(prev => ({ ...prev, location_type: value as any, geofence_lat: '', geofence_lon: '', geofence_radius: '100' }));
                        }
                      }}
                      disabled={aiLoading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="garden_coordinates">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Farm Location Coordinates
                          </div>
                        </SelectItem>
                        <SelectItem value="current_location">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Use My Current Location
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.location_type === 'garden_coordinates' && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label>Geofence Coordinates</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUseGardenLocation}
                            disabled={aiLoading}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Use Farm Location
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUseCurrentLocation}
                            disabled={aiLoading}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Use Current Location
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="geofence_lat">Latitude</Label>
                          <Input
                            id="geofence_lat"
                            type="number"
                            step="any"
                            value={formData.geofence_lat}
                            onChange={(e) => handleInputChange('geofence_lat', e.target.value)}
                            placeholder="e.g., -20.164235"
                            disabled={aiLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="geofence_lon">Longitude</Label>
                          <Input
                            id="geofence_lon"
                            type="number"
                            step="any"
                            value={formData.geofence_lon}
                            onChange={(e) => handleInputChange('geofence_lon', e.target.value)}
                            placeholder="e.g., 28.641425"
                            disabled={aiLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="geofence_radius">Radius (meters)</Label>
                          <Input
                            id="geofence_radius"
                            type="number"
                            step="1"
                            min="10"
                            value={formData.geofence_radius}
                            onChange={(e) => handleInputChange('geofence_radius', e.target.value)}
                            placeholder="100"
                            disabled={aiLoading}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="instructions">Special Instructions</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAISuggestInstructions}
                    disabled={aiLoading || !formData.title || !formData.description}
                    className="text-xs"
                  >
                    {aiSuggestLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    Generate Instructions
                  </Button>
                  <AITextButton
                    isLoading={instructionsLoading}
                    onImprove={() => assistInstructions(formData.instructions, 'improve', formData.title)}
                  />
                </div>
              </div>
              <SmartTextarea
                id="instructions"
                value={formData.instructions}
                onChange={(value) => handleInputChange('instructions', value)}
                placeholder="Any special instructions or requirements... (AI suggests as you type)"
                context="farm task instructions"
                rows={3}
                disabled={instructionsLoading || aiSuggestLoading}
              />
            </div>

            <Button type="submit" disabled={loading || aiLoading || !formData.title || !formData.description || !formData.assigned_to}>
              {loading ? 'Assigning...' : 'Assign Task'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Templates from database */}
      {!templatesLoading && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quick Assign from Templates
            </CardTitle>
            <CardDescription>Select a template to auto-fill the form above</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    title: template.title,
                    description: template.description,
                    priority: template.priority,
                    estimated_hours: template.estimated_hours?.toString() || '',
                    instructions: template.requirements || '',
                  }))}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">{template.title}</h4>
                      <Badge variant="outline" className="text-xs ml-2 shrink-0">{template.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {template.category && <Badge variant="secondary" className="text-xs">{template.category}</Badge>}
                      {template.estimated_hours && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{template.estimated_hours}h</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
