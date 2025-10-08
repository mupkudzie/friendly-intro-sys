import { useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GeofenceCheckProps {
  taskLocation: { latitude: number; longitude: number; radius: number };
  onLocationVerified: (location: { latitude: number; longitude: number }) => void;
}

const GARDEN_LOCATION = {
  latitude: -20.164235,
  longitude: 28.641425,
  name: 'Bulawayo North Garden'
};

export function GeofenceCheck({ taskLocation, onLocationVerified }: GeofenceCheckProps) {
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkLocation = async () => {
    setChecking(true);
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );

      const isWithinGeofence = distance <= taskLocation.radius;
      setVerified(isWithinGeofence);

      if (isWithinGeofence) {
        toast({
          title: "Location verified",
          description: "You are at the correct work site",
        });
        onLocationVerified({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } else {
        toast({
          title: "Location error",
          description: `You are ${Math.round(distance)}m away from the work site. Required: within ${taskLocation.radius}m`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Location error",
        description: "Failed to get your location. Please enable GPS.",
        variant: "destructive",
      });
      setVerified(false);
    } finally {
      setChecking(false);
    }
  };

  const useGardenLocation = () => {
    setChecking(true);
    setVerified(true);

    toast({
      title: "Location verified",
      description: `Using ${GARDEN_LOCATION.name} location`,
    });
    
    onLocationVerified({
      latitude: GARDEN_LOCATION.latitude,
      longitude: GARDEN_LOCATION.longitude,
    });

    setChecking(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Location Verification</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Verify you're at the work site (within {taskLocation.radius}m radius)
      </p>

      <div className="space-y-2">
        <Button
          onClick={checkLocation}
          disabled={checking}
          className="w-full"
        >
          {checking ? 'Checking Location...' : 'Use GPS Location'}
        </Button>

        <Button
          onClick={useGardenLocation}
          disabled={checking}
          variant="outline"
          className="w-full"
        >
          <MapPin className="h-4 w-4 mr-2" />
          Use {GARDEN_LOCATION.name}
        </Button>
      </div>

      {verified !== null && (
        <div className={`mt-4 flex items-center gap-2 p-3 rounded ${verified ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
          {verified ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-500">Location verified</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">Not at work site</span>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
