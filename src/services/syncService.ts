import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import {
  getPendingTimeLogs,
  getPendingActivityLogs,
  getPendingPhotos,
  getPendingTaskUpdates,
  markTimeLogSynced,
  markActivityLogSynced,
  markPhotoSynced,
  markTaskUpdateSynced,
  deletePendingTimeLog,
  deletePendingActivityLog,
  deletePendingPhoto,
  deletePendingTaskUpdate,
  getPendingCount,
} from './offlineStorage';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'pending_approval';

// Convert base64 to Blob
function base64ToBlob(base64: string, contentType: string = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

// Sync pending photos to Supabase Storage
async function syncPhotos(): Promise<{ synced: number; failed: number; errors: string[]; uploadedUrls: Map<string, string> }> {
  const pendingPhotos = await getPendingPhotos();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const uploadedUrls = new Map<string, string>();

  for (const photo of pendingPhotos) {
    try {
      const blob = base64ToBlob(photo.photo_data);
      const filePath = `${photo.user_id}/${photo.task_id}/${photo.file_name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('task-photos')
        .getPublicUrl(filePath);

      uploadedUrls.set(photo.id, urlData.publicUrl);
      await markPhotoSynced(photo.id);
      await deletePendingPhoto(photo.id);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`Photo sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, failed, errors, uploadedUrls };
}

// Sync pending time logs
async function syncTimeLogs(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const pendingLogs = await getPendingTimeLogs();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const log of pendingLogs) {
    try {
      // Check if this is an offline ID or real ID
      const isOfflineId = log.id.startsWith('offline_');
      
      if (isOfflineId) {
        // Insert new record
        const { error } = await supabase.from('time_logs').insert({
          task_id: log.task_id,
          user_id: log.user_id,
          start_time: log.start_time,
          end_time: log.end_time || null,
          total_hours: log.total_hours || null,
          break_time: log.break_time || 0,
        });

        if (error) throw error;
      } else {
        // Update existing record
        const { error } = await supabase
          .from('time_logs')
          .update({
            end_time: log.end_time,
            total_hours: log.total_hours,
            break_time: log.break_time,
          })
          .eq('id', log.id);

        if (error) throw error;
      }

      await markTimeLogSynced(log.id);
      await deletePendingTimeLog(log.id);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`Time log sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, failed, errors };
}

// Sync pending activity logs
async function syncActivityLogs(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const pendingLogs = await getPendingActivityLogs();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const log of pendingLogs) {
    try {
      const isOfflineId = log.id.startsWith('offline_');
      
      if (isOfflineId) {
        const insertData: {
          task_id: string;
          user_id: string;
          start_time?: string;
          end_time?: string;
          initial_photos?: Json;
          final_photos?: Json;
          activity_data_json?: Json;
          status?: string;
        } = {
          task_id: log.task_id,
          user_id: log.user_id,
        };
        
        if (log.start_time) insertData.start_time = log.start_time;
        if (log.end_time) insertData.end_time = log.end_time;
        if (log.initial_photos) insertData.initial_photos = log.initial_photos as unknown as Json;
        if (log.final_photos) insertData.final_photos = log.final_photos as unknown as Json;
        if (log.activity_data_json) insertData.activity_data_json = log.activity_data_json as unknown as Json;
        if (log.status) insertData.status = log.status;

        const { error } = await supabase.from('activity_logs').insert(insertData);

        if (error) throw error;
      } else {
        const updateData: Record<string, unknown> = {};
        if (log.end_time) updateData.end_time = log.end_time;
        if (log.final_photos) updateData.final_photos = log.final_photos;
        if (log.activity_data_json) updateData.activity_data_json = log.activity_data_json;
        if (log.status) updateData.status = log.status;

        const { error } = await supabase
          .from('activity_logs')
          .update(updateData)
          .eq('id', log.id);

        if (error) throw error;
      }

      await markActivityLogSynced(log.id);
      await deletePendingActivityLog(log.id);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`Activity log sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, failed, errors };
}

// Sync pending task updates
async function syncTaskUpdates(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const pendingUpdates = await getPendingTaskUpdates();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const update of pendingUpdates) {
    try {
      const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'approved', 'rejected', 'pending_approval'];
      const status = update.new_status as TaskStatus;
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${update.new_status}`);
      }

      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', update.task_id);

      if (error) throw error;

      await markTaskUpdateSynced(update.id);
      await deletePendingTaskUpdate(update.id);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`Task update sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, failed, errors };
}

// Main sync function
export async function syncAllPendingData(): Promise<SyncResult> {
  const isOnline = navigator.onLine;
  
  if (!isOnline) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      errors: ['No network connection available'],
    };
  }

  const results = await Promise.all([
    syncPhotos(),
    syncTimeLogs(),
    syncActivityLogs(),
    syncTaskUpdates(),
  ]);

  const syncedCount = results.reduce((acc, r) => acc + r.synced, 0);
  const failedCount = results.reduce((acc, r) => acc + r.failed, 0);
  const errors = results.flatMap(r => r.errors);

  return {
    success: failedCount === 0,
    syncedCount,
    failedCount,
    errors,
  };
}

// Check if there are pending items to sync
export async function hasPendingSync(): Promise<boolean> {
  const count = await getPendingCount();
  return count > 0;
}

// Get pending sync count
export { getPendingCount };

// Auto-sync on online event
let syncInProgress = false;

export function setupAutoSync(onSyncComplete?: (result: SyncResult) => void): () => void {
  const handleOnline = async () => {
    if (syncInProgress) return;
    
    syncInProgress = true;
    try {
      const hasPending = await hasPendingSync();
      if (hasPending) {
        const result = await syncAllPendingData();
        onSyncComplete?.(result);
      }
    } finally {
      syncInProgress = false;
    }
  };

  window.addEventListener('online', handleOnline);
  
  // Also try to sync on load if online
  if (navigator.onLine) {
    handleOnline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
