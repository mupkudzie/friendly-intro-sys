import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, User, MapPin } from 'lucide-react';

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: '',
    location: '',
    instructions: '',
    geofence_lat: '',
    geofence_lon: '',
    geofence_radius: '100',
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['student', 'garden_worker'])
      .order('full_name');

    if (!error && data) {
      setWorkers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setLoading(true);

    const taskData = {
      title: formData.title,
      description: formData.description,
      assigned_to: formData.assigned_to,
      assigned_by: userProfile.user_id,
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      due_date: formData.due_date || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      location: formData.location || null,
      instructions: formData.instructions || null,
      geofence_lat: formData.geofence_lat ? parseFloat(formData.geofence_lat) : null,
      geofence_lon: formData.geofence_lon ? parseFloat(formData.geofence_lon) : null,
      geofence_radius: formData.geofence_radius ? parseFloat(formData.geofence_radius) : 100,
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
      toast({
        title: "Success",
        description: "Task assigned successfully!",
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        due_date: '',
        estimated_hours: '',
        location: '',
        instructions: '',
        geofence_lat: '',
        geofence_lon: '',
        geofence_radius: '100',
      });
    }

    setLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
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
      location: 'Bulawayo North Garden',
    }));

    toast({
      title: "Garden location set",
      description: "Bulawayo North Garden (-20.164235, 28.641425)",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Assign New Task
          </CardTitle>
          <CardDescription>
            Create and assign a new task to students or garden workers
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
                  placeholder="e.g., Water the vegetable garden"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select 
                  value={formData.assigned_to} 
                  onValueChange={(value) => handleInputChange('assigned_to', value)}
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
                            ({worker.role.replace('_', ' ')})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what needs to be done..."
                required
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => handleInputChange('priority', value)}
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
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., Greenhouse A, Main Garden, Nursery"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Geofence Location (for mobile verification)</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleUseGardenLocation}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Use Garden Location
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleUseCurrentLocation}
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
                    placeholder="e.g., 33.6425"
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
                    placeholder="e.g., 73.0657"
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
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Special Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                placeholder="Any special instructions or requirements..."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading || !formData.title || !formData.description || !formData.assigned_to}>
              {loading ? 'Assigning...' : 'Assign Task'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Quick assign presets */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Assign Templates</CardTitle>
          <CardDescription>Common garden tasks you can quickly assign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Watering Plants', description: 'Water designated garden areas', location: 'Main Garden' },
              { title: 'Weeding', description: 'Remove weeds from flower beds', location: 'Flower Garden' },
              { title: 'Pruning', description: 'Trim and prune shrubs and trees', location: 'Tree Section' },
            ].map((template) => (
              <Card key={template.title} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      title: template.title, 
                      description: template.description,
                      location: template.location 
                    }))}>
                <CardContent className="p-4">
                  <h4 className="font-medium">{template.title}</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{template.location}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}