import { useAuth } from '@/hooks/useAuth';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { SupervisorDashboard } from '@/components/dashboard/SupervisorDashboard';
import { MobileWorkerDashboard } from '@/components/mobile/MobileWorkerDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your dashboard...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up your profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (userProfile.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'supervisor':
        return <SupervisorDashboard />;
      case 'student':
      case 'garden_worker':
        return <MobileWorkerDashboard userId={userProfile.user_id} userRole={userProfile.role} />;
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                Your role is not recognized. Please contact an administrator.
              </CardDescription>
            </CardHeader>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderDashboard()}
    </div>
  );
}