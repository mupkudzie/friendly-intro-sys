import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function OfflineSyncIndicator() {
  const { isOnline, isSyncing, pendingCount, manualSync } = useOfflineSync();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 px-2"
        >
          {isOnline ? (
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
            {isOnline ? (
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
