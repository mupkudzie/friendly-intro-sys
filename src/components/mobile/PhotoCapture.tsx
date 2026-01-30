import { useState } from 'react';
import { Camera, CameraResultType, CameraSource, GalleryPhotos } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ImagePlus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PhotoCaptureProps {
  minPhotos: number;
  maxPhotos: number;
  onPhotosCapture: (photos: string[]) => void;
  title: string;
  // When true, automatically submit photos as soon as minPhotos is reached
  autoSubmit?: boolean;
}

type UploadStatus = 'idle' | 'selecting' | 'processing' | 'ready';

export function PhotoCapture({ minPhotos, maxPhotos, onPhotosCapture, title, autoSubmit = true }: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);

  const selectPhotos = async () => {
    try {
      setUploadStatus('selecting');
      
      // Calculate how many more photos we can select
      const remainingSlots = maxPhotos - photos.length;
      
      // Use pickImages for multi-select from gallery
      const result = await Camera.pickImages({
        quality: 90,
        limit: remainingSlots,
      });

      if (result.photos && result.photos.length > 0) {
        setUploadStatus('processing');
        setProcessingProgress(0);
        
        const newPhotos: string[] = [];
        const totalPhotos = result.photos.length;
        
        // Process each photo and convert to data URL
        for (let i = 0; i < result.photos.length; i++) {
          const photo = result.photos[i];
          
          // Read the photo as base64
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          newPhotos.push(dataUrl);
          setProcessingProgress(Math.round(((i + 1) / totalPhotos) * 100));
        }

        const updatedPhotos = [...photos, ...newPhotos].slice(0, maxPhotos);
        setPhotos(updatedPhotos);
        setUploadStatus('ready');

        toast({
          title: "Photos selected",
          description: `${updatedPhotos.length}/${maxPhotos} photos ready`,
        });

        // If configured, automatically submit photos when minimum reached
        if (autoSubmit && updatedPhotos.length >= minPhotos) {
          setTimeout(() => onPhotosCapture(updatedPhotos), 250);
        }
      } else {
        setUploadStatus('idle');
      }
    } catch (error: any) {
      console.error('Gallery error:', error);
      setUploadStatus('idle');
      
      // Don't show error if user cancelled
      if (error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
        return;
      }
      
      toast({
        title: "Gallery error",
        description: "Failed to select photos. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    if (photos.length - 1 < minPhotos) {
      setUploadStatus('idle');
    }
  };

  const handleConfirm = () => {
    if (photos.length < minPhotos) {
      toast({
        title: "More photos needed",
        description: `Please select at least ${minPhotos} photos`,
        variant: "destructive",
      });
      return;
    }
    onPhotosCapture(photos);
  };

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'selecting':
        return 'Opening gallery...';
      case 'processing':
        return `Processing photos... ${processingProgress}%`;
      case 'ready':
        return photos.length >= minPhotos 
          ? 'Photos ready! Click Continue to proceed.' 
          : `Select ${minPhotos - photos.length} more photo(s)`;
      default:
        return `Select ${minPhotos}-${maxPhotos} photos from your gallery`;
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      {/* Status indicator */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          {getStatusMessage()}
        </p>
        
        {uploadStatus === 'processing' && (
          <div className="space-y-2">
            <Progress value={processingProgress} className="h-2" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing photos...</span>
            </div>
          </div>
        )}
        
        {uploadStatus === 'ready' && photos.length >= minPhotos && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Ready to continue</span>
          </div>
        )}
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square">
              <img 
                src={photo} 
                alt={`Photo ${index + 1}`} 
                className="w-full h-full object-cover rounded" 
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={selectPhotos}
          disabled={photos.length >= maxPhotos || uploadStatus === 'processing' || uploadStatus === 'selecting'}
          className="flex-1"
          variant={photos.length >= minPhotos ? "outline" : "default"}
        >
          {uploadStatus === 'selecting' || uploadStatus === 'processing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadStatus === 'selecting' ? 'Opening...' : 'Processing...'}
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Select Photos ({photos.length}/{maxPhotos})
            </>
          )}
        </Button>
        
        {photos.length >= minPhotos && (
          <Button 
            onClick={handleConfirm} 
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Continue
          </Button>
        )}
      </div>
    </Card>
  );
}
