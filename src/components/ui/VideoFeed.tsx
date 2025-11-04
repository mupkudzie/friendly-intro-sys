import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { Download, Video } from 'lucide-react';

export function VideoFeed({ src = '/video_feed', title = 'Live Feed' }: { src?: string; title?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordFile, setRecordFile] = useState<string | null>(null);

  const toggleRecording = async () => {
    if (!recording) {
      // start recording
      try {
        const res = await fetch('/start_recording', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        if (res.ok && data.file) {
          setRecordFile(null);
          setRecording(true);
        } else {
          alert('Failed to start recording: ' + (data?.message || 'unknown'));
        }
      } catch (err) {
        console.error(err);
        alert('Failed to start recording');
      }
    } else {
      // stop recording
      try {
        const res = await fetch('/stop_recording', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.file) {
          setRecordFile(data.file);
        } else if (data && data.status === 'not_recording') {
          setRecordFile(null);
          alert('No active recording');
        } else {
          alert('Failed to stop recording: ' + (data?.message || 'unknown'));
        }
      } catch (err) {
        console.error(err);
        alert('Failed to stop recording');
      } finally {
        setRecording(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEnabled(!enabled)}>
            <Camera className="w-4 h-4 mr-2" />
            {enabled ? 'Stop' : 'Start'}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleRecording} className={recording ? 'bg-red-600 text-white' : ''}>
            <Video className="w-4 h-4 mr-2" />
            {recording ? 'Recording...' : 'Record'}
          </Button>
          {recordFile && (
            <a href={`/recordings/${recordFile}`} className="inline-flex items-center" target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Download
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full flex items-center justify-center">
          {enabled ? (
            <img src={src} alt="Live video feed" className="w-full max-w-3xl rounded" />
          ) : (
            <div className="text-sm text-muted-foreground">Video paused</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
