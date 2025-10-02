import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, User } from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    role: string;
  } | null;
}

interface TaskCommentsProps {
  taskId: string;
  userId: string;
}

export function TaskComments({ taskId, userId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel('task-comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        profiles!task_comments_user_id_fkey (
          full_name,
          role
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return;
    }

    setComments(data as any || []);
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: userId,
        comment: newComment.trim(),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } else {
      setNewComment('');
      toast({
        title: "Comment posted",
        description: "Your comment has been added",
      });
    }

    setLoading(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments</h3>
      </div>

      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg ${
                comment.user_id === userId
                  ? 'bg-primary/10 ml-4'
                  : 'bg-muted mr-4'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {comment.profiles?.full_name || 'Unknown User'}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(comment.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
              <p className="text-sm">{comment.comment}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[60px]"
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || !newComment.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
