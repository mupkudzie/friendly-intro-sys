import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { SupervisorDashboard } from '@/components/dashboard/SupervisorDashboard';
import { MobileWorkerDashboard } from '@/components/mobile/MobileWorkerDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, userProfile, loading, profileLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showRetry, setShowRetry] = useState(false);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  // Show retry option after 5 seconds if profile is still loading
  useEffect(() => {
    if (user && !userProfile && !profileLoading) {
      const timer = setTimeout(() => setShowRetry(true), 5000);
      return () => clearTimeout(timer);
    }
    setShowRetry(false);
  }, [user, userProfile, profileLoading]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not authenticated, show nothing while redirecting
  if (!user) {
    return null;
  }

  // Profile is still loading
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile not found - offer retry or sign out
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Profile Setup</CardTitle>
            <CardDescription>
              {showRetry 
                ? "We couldn't find your profile. This might happen if your account is pending approval."
                : "Setting up your profile..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!showRetry && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Please wait...</span>
              </div>
            )}
            {showRetry && (
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={async () => {
                    await signOut();
                    navigate('/auth');
                  }}
                >
                  Sign Out
                </Button>
              </div>
            )}
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
