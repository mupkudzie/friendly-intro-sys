import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, Leaf, Shield } from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  student_id: string | null;
  department: string | null;
  contact_number: string | null;
  created_at: string;
}

export function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProfiles(data);
    }
    setLoading(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'supervisor': return <Users className="w-4 h-4" />;
      case 'garden_worker': return <Leaf className="w-4 h-4" />;
      case 'student': return <GraduationCap className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleStyles = {
      admin: 'bg-red-100 text-red-800',
      supervisor: 'bg-blue-100 text-blue-800',
      garden_worker: 'bg-yellow-100 text-yellow-800',
      student: 'bg-green-100 text-green-800',
    };

    return (
      <Badge className={roleStyles[role as keyof typeof roleStyles] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">User Management</h2>
        <Badge variant="secondary">{profiles.length} users</Badge>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <Card key={profile.user_id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {getRoleIcon(profile.role)}
                  {profile.full_name}
                </CardTitle>
                {getRoleBadge(profile.role)}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {profile.student_id && (
                  <div>
                    <span className="font-medium">Student ID:</span> {profile.student_id}
                  </div>
                )}
                {profile.department && (
                  <div>
                    <span className="font-medium">Department:</span> {profile.department}
                  </div>
                )}
                {profile.contact_number && (
                  <div>
                    <span className="font-medium">Contact:</span> {profile.contact_number}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}