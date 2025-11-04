import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera as CameraIcon, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PhotoCaptureProps {
  minPhotos: number;
  maxPhotos: number;
  onPhotosCapture: (photos: string[]) => void;
  title: string;
  // When true, automatically submit photos as soon as minPhotos is reached
  autoSubmit?: boolean;
}

export function PhotoCapture({ minPhotos, maxPhotos, onPhotosCapture, title, autoSubmit = true }: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>([]);

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        const newPhotos = [...photos, image.dataUrl];
        setPhotos(newPhotos);

        if (newPhotos.length >= minPhotos) {
          toast({
            title: "Photo captured",
            description: `${newPhotos.length}/${maxPhotos} photos taken`,
          });

          // If configured, automatically submit photos when minimum reached
          if (autoSubmit) {
            // small timeout to allow UI to update before parent dialogs/navigation
            setTimeout(() => onPhotosCapture(newPhotos), 250);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Camera error",
        description: "Failed to take photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (photos.length < minPhotos) {
      toast({
        title: "More photos needed",
        description: `Please take at least ${minPhotos} photos`,
        variant: "destructive",
      });
      return;
    }
    onPhotosCapture(photos);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Take {minPhotos}-{maxPhotos} photos of the work area
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {photos.map((photo, index) => (
          <div key={index} className="relative">
            <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-32 object-cover rounded" />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => removePhoto(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={takePhoto}
          disabled={photos.length >= maxPhotos}
          className="flex-1"
        >
          <CameraIcon className="mr-2 h-4 w-4" />
          Take Photo ({photos.length}/{maxPhotos})
        </Button>
        
        {photos.length >= minPhotos && (
          <Button onClick={handleConfirm} variant="default">
            Continue
          </Button>
        )}
      </div>
    </Card>
  );
}
