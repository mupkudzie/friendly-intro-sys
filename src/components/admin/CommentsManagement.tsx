import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MessageSquare, User, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  task: {
    title: string;
    status: string;
  };
  profile: {
    full_name: string;
    role: string;
  };
}

export function CommentsManagement() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [filteredComments, setFilteredComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, []);

  useEffect(() => {
    filterComments();
  }, [comments, searchTerm, roleFilter]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        task:tasks(title, status),
        profile:profiles(full_name, role)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch comments',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setComments(data as any);
    setLoading(false);
  };

  const filterComments = () => {
    let filtered = [...comments];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        comment =>
          comment.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
          comment.profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          comment.task.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by role (only show student and garden_worker comments)
    if (roleFilter !== 'all') {
      filtered = filtered.filter(comment => comment.profile.role === roleFilter);
    } else {
      // By default, only show comments from students and garden workers
      filtered = filtered.filter(comment => 
        comment.profile.role === 'student' || comment.profile.role === 'garden_worker'
      );
    }

    setFilteredComments(filtered);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading comments...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            User Comments & Feedback
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            View all comments from students and farm workers
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search comments, users, or tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="garden_worker">Garden Workers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{filteredComments.length}</div>
              <div className="text-sm text-muted-foreground">Total Comments</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {filteredComments.filter(c => c.profile.role === 'student').length}
              </div>
              <div className="text-sm text-muted-foreground">Student Comments</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {filteredComments.filter(c => c.profile.role === 'garden_worker').length}
              </div>
              <div className="text-sm text-muted-foreground">Worker Comments</div>
            </div>
          </div>

          {/* Comments List */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{comment.profile.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={comment.profile.role === 'student' ? 'outline' : 'secondary'}>
                        {comment.profile.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium text-sm">{comment.task.title}</div>
                        <Badge variant="outline" className="mt-1">
                          {comment.task.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm line-clamp-2">{comment.comment}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(comment.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredComments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No comments found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
