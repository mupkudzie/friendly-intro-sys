import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Image as ImageIcon, User, Clock, CheckCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface PhotoLog {
  id: string;
  user_id: string;
  task_id: string;
  initial_photos: string[];
  final_photos: string[];
  start_time: string;
  end_time: string | null;
  status: string;
  user_name: string;
  task_title: string;
}

export function PhotoGallery() {
  const [photoLogs, setPhotoLogs] = useState<PhotoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<PhotoLog | null>(null);
  const [viewMode, setViewMode] = useState<'initial' | 'final'>('initial');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchPhotoLogs();
  }, []);

  const fetchPhotoLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          profiles!activity_logs_user_id_fkey(full_name),
          tasks!activity_logs_task_id_fkey(title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLogs: PhotoLog[] = (data || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        task_id: log.task_id,
        initial_photos: log.initial_photos || [],
        final_photos: log.final_photos || [],
        start_time: log.start_time,
        end_time: log.end_time,
        status: log.status || 'in_progress',
        user_name: log.profiles?.full_name || 'Unknown User',
        task_title: log.tasks?.title || 'Unknown Task',
      }));

      setPhotoLogs(formattedLogs);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load photo logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  // Group photos by user
  const photosByUser = photoLogs.reduce((acc, log) => {
    if (!acc[log.user_id]) {
      acc[log.user_id] = {
        user_name: log.user_name,
        logs: []
      };
    }
    acc[log.user_id].logs.push(log);
    return acc;
  }, {} as Record<string, { user_name: string; logs: PhotoLog[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading photo gallery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Photo Gallery</h2>
          <p className="text-muted-foreground">View all work photos from garden activities</p>
        </div>
        <Button onClick={fetchPhotoLogs} variant="outline">
          Refresh
        </Button>
      </div>

      <div className="space-y-8">
        {photoLogs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No photos available yet</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(photosByUser).map(([userId, { user_name, logs }]) => (
            <div key={userId} className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-primary">
                <User className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-foreground">{user_name}</h3>
                <Badge variant="secondary" className="ml-2">
                  {logs.length} task{logs.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid gap-4 ml-4">
                {logs.map((log) => (
                  <Card key={log.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{log.task_title}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(log.start_time), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </div>
                        <Badge variant="outline" className={getStatusColor(log.status)}>
                          {log.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Initial Photos */}
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-foreground">
                            <Clock className="w-4 h-4" />
                            Before Work ({log.initial_photos.length} photos)
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {log.initial_photos.slice(0, 6).map((photo, index) => (
                              <div
                                key={index}
                                className="relative aspect-square rounded cursor-pointer overflow-hidden border border-border hover:border-primary transition-colors"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setViewMode('initial');
                                  setSelectedPhoto(photo);
                                }}
                              >
                                <img
                                  src={photo}
                                  alt={`Before ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Final Photos */}
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-foreground">
                            <CheckCircle className="w-4 h-4" />
                            After Work ({log.final_photos.length} photos)
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {log.final_photos.length > 0 ? (
                              log.final_photos.slice(0, 6).map((photo, index) => (
                                <div
                                  key={index}
                                  className="relative aspect-square rounded cursor-pointer overflow-hidden border border-border hover:border-primary transition-colors"
                                  onClick={() => {
                                    setSelectedLog(log);
                                    setViewMode('final');
                                    setSelectedPhoto(photo);
                                  }}
                                >
                                  <img
                                    src={photo}
                                    alt={`After ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="col-span-3 text-center text-muted-foreground text-sm py-4">
                                No final photos yet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => {
                          setSelectedLog(log);
                          setViewMode('initial');
                        }}
                      >
                        View All Photos
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedLog?.task_title}</DialogTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {selectedLog?.user_name}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {selectedLog && format(new Date(selectedLog.start_time), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'initial' ? 'default' : 'outline'}
                onClick={() => setViewMode('initial')}
                className="flex-1"
              >
                Before Work ({selectedLog?.initial_photos.length || 0})
              </Button>
              <Button
                variant={viewMode === 'final' ? 'default' : 'outline'}
                onClick={() => setViewMode('final')}
                className="flex-1"
              >
                After Work ({selectedLog?.final_photos.length || 0})
              </Button>
            </div>

            <ScrollArea className="h-[60vh]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                {(viewMode === 'initial' ? selectedLog?.initial_photos : selectedLog?.final_photos)?.map(
                  (photo, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded cursor-pointer overflow-hidden border-2 border-border hover:border-primary transition-colors"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={photo}
                        alt={`${viewMode === 'initial' ? 'Before' : 'After'} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Photo Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen p-0 bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Full view"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
