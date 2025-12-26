import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  syncAllPendingData,
  hasPendingSync,
  getPendingCount,
  setupAutoSync,
  SyncResult,
} from '@/services/syncService';

export function useOfflineSync() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Your connection has been restored. Syncing pending data...",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline Mode",
        description: "You're now working offline. Your data will be saved locally and synced when you're back online.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, []);

  // Setup auto-sync
  useEffect(() => {
    const cleanup = setupAutoSync((result: SyncResult) => {
      if (result.success && result.syncedCount > 0) {
        toast({
          title: "Data Synced",
          description: `Successfully synced ${result.syncedCount} item(s).`,
        });
      } else if (result.failedCount > 0) {
        toast({
          title: "Sync Partial",
          description: `Synced ${result.syncedCount} items, ${result.failedCount} failed.`,
          variant: "destructive",
        });
      }
      
      // Update pending count after sync
      getPendingCount().then(setPendingCount);
    });

    return cleanup;
  }, [toast]);

  // Manual sync function
  const manualSync = useCallback(async () => {
    if (!isOnline) {
      toast({
        title: "Cannot Sync",
        description: "You're currently offline. Please connect to the internet to sync.",
        variant: "destructive",
      });
      return;
    }

    const hasPending = await hasPendingSync();
    if (!hasPending) {
      toast({
        title: "All Synced",
        description: "There's no pending data to sync.",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncAllPendingData();
      
      if (result.success) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${result.syncedCount} item(s).`,
        });
      } else {
        toast({
          title: "Sync Issues",
          description: `Synced ${result.syncedCount} items, ${result.failedCount} failed. Will retry later.`,
          variant: "destructive",
        });
      }

      const count = await getPendingCount();
      setPendingCount(count);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, toast]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    manualSync,
  };
}
