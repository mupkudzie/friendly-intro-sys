import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FarmZone {
  id: string;
  name: string;
  description: string;
  gps_coordinates: any;
  active: boolean;
}

export function FarmZonesMap() {
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    fetchZones();
    getCurrentLocation();
  }, []);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('farm_zones')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast.error('Failed to load farm zones');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const getDistanceToZone = (zone: FarmZone) => {
    if (!userLocation) return null;
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      zone.gps_coordinates.lat,
      zone.gps_coordinates.lon
    );
    return Math.round(distance);
  };

  const openInMaps = (zone: FarmZone) => {
    const { lat, lon } = zone.gps_coordinates;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(mapsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-center text-muted-foreground">Loading farm zones...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Farm Zones
          </CardTitle>
          <CardDescription>
            View assigned work areas and navigate to specific zones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {zones.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active farm zones available
            </p>
          ) : (
            zones.map((zone) => {
              const distance = getDistanceToZone(zone);
              return (
                <Card key={zone.id} className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{zone.name}</CardTitle>
                        <CardDescription>{zone.description}</CardDescription>
                      </div>
                      {distance !== null && (
                        <Badge variant="secondary">
                          {distance < 1000 
                            ? `${distance}m away`
                            : `${(distance / 1000).toFixed(1)}km away`
                          }
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <p>Coordinates: {zone.gps_coordinates.lat.toFixed(6)}, {zone.gps_coordinates.lon.toFixed(6)}</p>
                        {zone.gps_coordinates.radius && (
                          <p>Radius: {zone.gps_coordinates.radius}m</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInMaps(zone)}
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Navigate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
