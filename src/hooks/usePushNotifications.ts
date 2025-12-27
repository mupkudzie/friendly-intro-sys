import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export function usePushNotifications() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: "Notifications Enabled",
          description: "You will now receive push notifications.",
        });
        return true;
      } else {
        toast({
          title: "Notifications Blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const showSyncNotification = useCallback((syncedCount: number, failedCount: number = 0) => {
    if (failedCount > 0) {
      showNotification('Sync Partial', {
        body: `Synced ${syncedCount} items, ${failedCount} failed. Will retry later.`,
        tag: 'sync-notification',
      });
    } else if (syncedCount > 0) {
      showNotification('Sync Complete', {
        body: `Successfully synced ${syncedCount} item${syncedCount !== 1 ? 's' : ''}.`,
        tag: 'sync-notification',
      });
    }
  }, [showNotification]);

  const showOfflineNotification = useCallback(() => {
    showNotification('Working Offline', {
      body: 'Your data will be saved locally and synced when you reconnect.',
      tag: 'offline-notification',
    });
  }, [showNotification]);

  const showOnlineNotification = useCallback((pendingCount: number) => {
    showNotification('Back Online', {
      body: pendingCount > 0 
        ? `Syncing ${pendingCount} pending item${pendingCount !== 1 ? 's' : ''}...`
        : 'Your connection has been restored.',
      tag: 'online-notification',
    });
  }, [showNotification]);

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    showSyncNotification,
    showOfflineNotification,
    showOnlineNotification,
  };
}
