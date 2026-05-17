import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Check, X, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

export function NotificationCenter() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;
    fetchNotifications();

    // Realtime: refresh whenever this user's notifications change
    const channel = supabase
      .channel(`notifications-${userProfile.user_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userProfile.user_id}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  const fetchNotifications = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userProfile.user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      const notificationsWithSenders = await Promise.all(
        data.map(async (notification) => {
          if (notification.sender_id) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', notification.sender_id)
              .single();
            return { ...notification, sender: senderData };
          }
          return notification;
        })
      );
      setNotifications(notificationsWithSenders);

      // Auto-mark every visible notification as read so the badge clears
      const unreadIds = data.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        window.dispatchEvent(new CustomEvent('notifications-updated'));
      }
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  };

  const deleteOne = async (notificationId: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
      return;
    }
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  };

  const clearAll = async () => {
    if (!userProfile || notifications.length === 0) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userProfile.user_id);
    if (error) {
      toast({ title: 'Failed to clear', description: error.message, variant: 'destructive' });
      return;
    }
    setNotifications([]);
    window.dispatchEvent(new CustomEvent('notifications-updated'));
    toast({ title: 'Notifications cleared' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_review':
        return '📋';
      case 'task_request':
        return '🔔';
      case 'program_completion':
        return '🎉';
      default:
        return '📢';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading notifications...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </CardTitle>
          {notifications.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            No notifications yet
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-background'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm md:text-base truncate">{notification.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1 break-words">
                        {notification.message}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-2 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                        {notification.sender && (
                          <span className="hidden sm:inline">• from {notification.sender.full_name}</span>
                        )}
                        {notification.sender && (
                          <span className="sm:hidden">from {notification.sender.full_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {!notification.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteOne(notification.id)}
                      title="Delete notification"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}