import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { SupervisorDashboard } from '@/components/dashboard/SupervisorDashboard';
import { MobileWorkerDashboard } from '@/components/mobile/MobileWorkerDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

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

  // If not authenticated, show nothing while redirecting
  if (!user) {
    return null;
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Setting up your profile...
            </div>
            <p className="text-sm text-muted-foreground text-center">
              If this takes too long, try refreshing the page or signing in again.
            </p>
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