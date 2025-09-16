import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Check, X } from 'lucide-react';
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
    if (userProfile) {
      fetchNotifications();
    }
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
      // Get sender information separately
      const notificationsWithSenders = await Promise.all(
        data.map(async (notification) => {
          if (notification.sender_id) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', notification.sender_id)
              .single();
            
            return {
              ...notification,
              sender: senderData
            };
          }
          return notification;
        })
      );
      setNotifications(notificationsWithSenders);
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
    }
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
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </CardTitle>
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
                  {!notification.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(notification.id)}
                      className="flex-shrink-0 ml-2"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}