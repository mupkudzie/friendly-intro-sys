import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FarmZone {
  id: string;
  name: string;
  description: string;
  gps_coordinates: any;
  active: boolean;
}

export function FarmZones() {
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newZone, setNewZone] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    radius: '100',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('farm_zones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async () => {
    try {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase.from('farm_zones').insert({
        name: newZone.name,
        description: newZone.description,
        gps_coordinates: {
          latitude: parseFloat(newZone.latitude),
          longitude: parseFloat(newZone.longitude),
          radius: parseFloat(newZone.radius),
        },
        created_by: user.data.user?.id,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Farm zone created successfully',
      });

      setShowDialog(false);
      setNewZone({ name: '', description: '', latitude: '', longitude: '', radius: '100' });
      fetchZones();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Farm Zones</h2>
          <p className="text-muted-foreground">Manage GPS-based farm zones</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Farm Zone</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Zone Name"
                value={newZone.name}
                onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newZone.description}
                onChange={(e) => setNewZone({ ...newZone, description: e.target.value })}
              />
              <Input
                placeholder="Latitude"
                type="number"
                step="any"
                value={newZone.latitude}
                onChange={(e) => setNewZone({ ...newZone, latitude: e.target.value })}
              />
              <Input
                placeholder="Longitude"
                type="number"
                step="any"
                value={newZone.longitude}
                onChange={(e) => setNewZone({ ...newZone, longitude: e.target.value })}
              />
              <Input
                placeholder="Radius (meters)"
                type="number"
                value={newZone.radius}
                onChange={(e) => setNewZone({ ...newZone, radius: e.target.value })}
              />
              <Button onClick={handleCreateZone} className="w-full">
                Create Zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div>Loading zones...</div>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No farm zones created yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {zone.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{zone.description}</p>
                <div className="text-sm">
                  <div>
                    <strong>Coordinates:</strong> {zone.gps_coordinates?.latitude}, {zone.gps_coordinates?.longitude}
                  </div>
                  <div>
                    <strong>Radius:</strong> {zone.gps_coordinates?.radius}m
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
