import { openDB, IDBPDatabase } from 'idb';

interface PendingTimeLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  total_hours?: number;
  break_time?: number;
  created_at: string;
  synced: boolean;
}

interface PendingActivityLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time?: string;
  end_time?: string;
  initial_photos?: string[]; // Base64 encoded for offline
  final_photos?: string[];
  activity_data_json?: object;
  status?: string;
  created_at: string;
  synced: boolean;
}

interface PendingPhoto {
  id: string;
  task_id: string;
  user_id: string;
  photo_data: string; // Base64 encoded
  photo_type: 'initial' | 'final';
  file_name: string;
  created_at: string;
  synced: boolean;
}

interface PendingTaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  new_status: string;
  updated_at: string;
  synced: boolean;
}

const DB_NAME = 'garden-monitoring-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Time logs store
        if (!db.objectStoreNames.contains('pending_time_logs')) {
          const timeLogsStore = db.createObjectStore('pending_time_logs', { keyPath: 'id' });
          timeLogsStore.createIndex('by-synced', 'synced');
        }
        
        // Activity logs store
        if (!db.objectStoreNames.contains('pending_activity_logs')) {
          const activityLogsStore = db.createObjectStore('pending_activity_logs', { keyPath: 'id' });
          activityLogsStore.createIndex('by-synced', 'synced');
        }
        
        // Photos store
        if (!db.objectStoreNames.contains('pending_photos')) {
          const photosStore = db.createObjectStore('pending_photos', { keyPath: 'id' });
          photosStore.createIndex('by-synced', 'synced');
          photosStore.createIndex('by-task', 'task_id');
        }
        
        // Task updates store
        if (!db.objectStoreNames.contains('pending_task_updates')) {
          const taskUpdatesStore = db.createObjectStore('pending_task_updates', { keyPath: 'id' });
          taskUpdatesStore.createIndex('by-synced', 'synced');
        }
      },
    });
  }
  return dbPromise;
}

// Generate unique ID for offline records
export function generateOfflineId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Time Logs
export async function savePendingTimeLog(timeLog: Omit<PendingTimeLog, 'synced' | 'created_at'>): Promise<string> {
  const db = await getDB();
  const record: PendingTimeLog = {
    ...timeLog,
    created_at: new Date().toISOString(),
    synced: false,
  };
  await db.put('pending_time_logs', record);
  return record.id;
}

export async function getPendingTimeLogs(): Promise<PendingTimeLog[]> {
  const db = await getDB();
  const all = await db.getAll('pending_time_logs');
  return all.filter((log: PendingTimeLog) => !log.synced);
}

export async function markTimeLogSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('pending_time_logs', id) as PendingTimeLog | undefined;
  if (record) {
    record.synced = true;
    await db.put('pending_time_logs', record);
  }
}

export async function deletePendingTimeLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_time_logs', id);
}

// Activity Logs
export async function savePendingActivityLog(activityLog: Omit<PendingActivityLog, 'synced' | 'created_at'>): Promise<string> {
  const db = await getDB();
  const record: PendingActivityLog = {
    ...activityLog,
    created_at: new Date().toISOString(),
    synced: false,
  };
  await db.put('pending_activity_logs', record);
  return record.id;
}

export async function getPendingActivityLogs(): Promise<PendingActivityLog[]> {
  const db = await getDB();
  const all = await db.getAll('pending_activity_logs');
  return all.filter((log: PendingActivityLog) => !log.synced);
}

export async function markActivityLogSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('pending_activity_logs', id) as PendingActivityLog | undefined;
  if (record) {
    record.synced = true;
    await db.put('pending_activity_logs', record);
  }
}

export async function deletePendingActivityLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_activity_logs', id);
}

// Photos
export async function savePendingPhoto(photo: Omit<PendingPhoto, 'synced' | 'created_at'>): Promise<string> {
  const db = await getDB();
  const record: PendingPhoto = {
    ...photo,
    created_at: new Date().toISOString(),
    synced: false,
  };
  await db.put('pending_photos', record);
  return record.id;
}

export async function getPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await getDB();
  const all = await db.getAll('pending_photos');
  return all.filter((photo: PendingPhoto) => !photo.synced);
}

export async function getPendingPhotosByTask(taskId: string): Promise<PendingPhoto[]> {
  const db = await getDB();
  const all = await db.getAll('pending_photos');
  return all.filter((photo: PendingPhoto) => photo.task_id === taskId && !photo.synced);
}

export async function markPhotoSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('pending_photos', id) as PendingPhoto | undefined;
  if (record) {
    record.synced = true;
    await db.put('pending_photos', record);
  }
}

export async function deletePendingPhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_photos', id);
}

// Task Updates
export async function savePendingTaskUpdate(taskUpdate: Omit<PendingTaskUpdate, 'synced'>): Promise<string> {
  const db = await getDB();
  const record: PendingTaskUpdate = {
    ...taskUpdate,
    synced: false,
  };
  await db.put('pending_task_updates', record);
  return record.id;
}

export async function getPendingTaskUpdates(): Promise<PendingTaskUpdate[]> {
  const db = await getDB();
  const all = await db.getAll('pending_task_updates');
  return all.filter((update: PendingTaskUpdate) => !update.synced);
}

export async function markTaskUpdateSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('pending_task_updates', id) as PendingTaskUpdate | undefined;
  if (record) {
    record.synced = true;
    await db.put('pending_task_updates', record);
  }
}

export async function deletePendingTaskUpdate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_task_updates', id);
}

// Get total pending count
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  const [timeLogs, activityLogs, photos, taskUpdates] = await Promise.all([
    db.getAll('pending_time_logs'),
    db.getAll('pending_activity_logs'),
    db.getAll('pending_photos'),
    db.getAll('pending_task_updates'),
  ]);
  
  const pendingTimeLogs = timeLogs.filter((log: PendingTimeLog) => !log.synced);
  const pendingActivityLogs = activityLogs.filter((log: PendingActivityLog) => !log.synced);
  const pendingPhotos = photos.filter((photo: PendingPhoto) => !photo.synced);
  const pendingTaskUpdates = taskUpdates.filter((update: PendingTaskUpdate) => !update.synced);
  
  return pendingTimeLogs.length + pendingActivityLogs.length + pendingPhotos.length + pendingTaskUpdates.length;
}

// Clear all synced data
export async function clearSyncedData(): Promise<void> {
  const db = await getDB();
  
  const stores = ['pending_time_logs', 'pending_activity_logs', 'pending_photos', 'pending_task_updates'];
  
  for (const storeName of stores) {
    const all = await db.getAll(storeName);
    for (const record of all) {
      if (record.synced) {
        await db.delete(storeName, record.id);
      }
    }
  }
}
