import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Camera as CameraIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PhotoCaptureProps {
  minPhotos: number;
  maxPhotos?: number; // Kept for interface compatibility but ignored for unlimited capture
  onPhotosCapture: (photos: string[]) => void;
  title: string;
  autoSubmit?: boolean;
}

type UploadStatus = 'idle' | 'selecting' | 'processing' | 'ready';

export function PhotoCapture({ minPhotos, maxPhotos = 100, onPhotosCapture, title, autoSubmit = true }: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);

  const takePhoto = async () => {
    try {
      setUploadStatus('selecting');
      
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera, // Force camera only (no gallery)
      });

      if (photo.webPath) {
        setUploadStatus('processing');
        setProcessingProgress(0);
        
        // Process the captured photo and convert to data URL
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        const updatedPhotos = [...photos, dataUrl];
        setPhotos(updatedPhotos);
        setUploadStatus('ready');

        toast({
          title: "Photo captured",
          description: `${updatedPhotos.length} photo(s) captured`,
        });

        // If configured, automatically submit photos when minimum reached
        if (autoSubmit && updatedPhotos.length >= minPhotos) {
          setTimeout(() => onPhotosCapture(updatedPhotos), 250);
        }
      } else {
        setUploadStatus('idle');
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      setUploadStatus('idle');
      
      // Don't show error if user cancelled
      if (error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
        return;
      }
      
      toast({
        title: "Camera error",
        description: "Failed to capture photo. Please try again.",
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
        description: `Please capture at least ${minPhotos} photos`,
        variant: "destructive",
      });
      return;
    }
    onPhotosCapture(photos);
  };

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'selecting':
        return 'Opening camera...';
      case 'processing':
        return `Processing photo... ${processingProgress}%`;
      case 'ready':
        return photos.length >= minPhotos 
          ? 'Photos ready! Click Continue to proceed.' 
          : `Capture ${minPhotos - photos.length} more photo(s)`;
      default:
        return `Capture at least ${minPhotos} photos using your camera`;
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
              <span>Preparing photo...</span>
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
          onClick={takePhoto}
          disabled={uploadStatus === 'processing' || uploadStatus === 'selecting'}
          className="flex-1"
          variant={photos.length >= minPhotos ? "outline" : "default"}
        >
          {uploadStatus === 'selecting' || uploadStatus === 'processing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadStatus === 'selecting' ? 'Opening Camera...' : 'Processing...'}
            </>
          ) : (
            <>
              <CameraIcon className="mr-2 h-4 w-4" />
              Capture Photo ({photos.length} taken)
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
