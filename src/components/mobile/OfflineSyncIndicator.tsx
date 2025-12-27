import { useEffect, useRef } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

export function OfflineSyncIndicator() {
  const { isOnline, isSyncing, pendingCount, manualSync } = useOfflineSync();
  const { toast } = useToast();
  const prevOnlineRef = useRef(isOnline);
  const prevPendingRef = useRef(pendingCount);
  const prevSyncingRef = useRef(isSyncing);

  // Sync notifications
  useEffect(() => {
    // Coming back online
    if (!prevOnlineRef.current && isOnline) {
      toast({
        title: "Back Online",
        description: pendingCount > 0 
          ? `Syncing ${pendingCount} pending item${pendingCount !== 1 ? 's' : ''}...` 
          : "Your connection has been restored.",
      });
    }

    // Going offline
    if (prevOnlineRef.current && !isOnline) {
      toast({
        title: "Working Offline",
        description: "Your data will be saved locally and synced when you're back online.",
        variant: "destructive",
      });
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline, pendingCount, toast]);

  // Sync completion notification
  useEffect(() => {
    // Syncing finished
    if (prevSyncingRef.current && !isSyncing && isOnline) {
      const syncedCount = prevPendingRef.current - pendingCount;
      if (syncedCount > 0) {
        toast({
          title: "Sync Complete",
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Successfully synced {syncedCount} item{syncedCount !== 1 ? 's' : ''}.</span>
            </div>
          ),
        });
      }
    }

    prevSyncingRef.current = isSyncing;
    prevPendingRef.current = pendingCount;
  }, [isSyncing, pendingCount, isOnline, toast]);

  // New pending items notification
  useEffect(() => {
    if (!isOnline && pendingCount > prevPendingRef.current) {
      const newItems = pendingCount - prevPendingRef.current;
      toast({
        title: "Saved Locally",
        description: `${newItems} item${newItems !== 1 ? 's' : ''} saved offline. Will sync when online.`,
      });
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, isOnline, toast]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 px-2"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">Syncing...</span>
              </>
            ) : isOnline ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-700">Online</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-sm font-medium text-destructive">Offline</span>
              </>
            )}
          </div>

          {!isOnline && (
            <p className="text-xs text-muted-foreground">
              You're working offline. Your data is being saved locally and will sync automatically when you're back online.
            </p>
          )}

          <div className="flex items-center justify-between py-2 border-t">
            <div className="flex items-center gap-2">
              {pendingCount > 0 ? (
                <CloudOff className="h-4 w-4 text-amber-600" />
              ) : (
                <Cloud className="h-4 w-4 text-green-600" />
              )}
              <span className="text-sm">
                {pendingCount > 0 ? (
                  <>{pendingCount} item{pendingCount !== 1 ? 's' : ''} pending sync</>
                ) : (
                  'All data synced'
                )}
              </span>
            </div>
          </div>

          {pendingCount > 0 && isOnline && (
            <Button
              size="sm"
              className="w-full"
              onClick={manualSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          )}

          {!isOnline && pendingCount > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
              Connect to the internet to sync your pending data.
            </p>
          )}

          {isOnline && pendingCount === 0 && !isSyncing && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              <span>All your data is synced and up to date.</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
