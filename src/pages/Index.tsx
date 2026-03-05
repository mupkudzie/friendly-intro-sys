import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sprout, Users, Clock, BarChart3, Loader2, ChevronRight, MapPin, Shield } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
    setShowTimeout(false);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div>Loading...</div>
          {showTimeout && (
            <div className="text-center text-sm text-muted-foreground">
              <p>Taking longer than expected...</p>
              <Button variant="link" onClick={() => window.location.reload()} className="mt-2">
                Refresh page
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Users,
      title: 'Team Management',
      description: 'Organize students and workers with role-based access, approvals, and real-time activity tracking.',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: Sprout,
      title: 'Smart Task Assignment',
      description: 'Create, assign, and monitor farm tasks with templates, priorities, and AI-powered suggestions.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Clock,
      title: 'Time & Attendance',
      description: 'Automated clock in/out with GPS verification, break tracking, and weekly timesheets.',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'AI-refined reports, performance dashboards, and actionable insights for better decisions.',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: MapPin,
      title: 'GPS Verification',
      description: 'Random location checks ensure workers are on-site with real-time supervisor alerts.',
      color: 'bg-rose-50 text-rose-600',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Role-based security, audit trails, and offline support keep your data safe and accessible.',
      color: 'bg-slate-50 text-slate-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Sprout className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">FarmFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')} className="text-sm font-medium">
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')} className="text-sm font-medium rounded-xl px-5">
              Get Started
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sprout className="w-4 h-4" />
              Smart Farm Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
              Manage your farm
              <span className="block text-primary mt-1">with confidence</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Track tasks, monitor attendance, verify locations, and generate insights — all in one beautifully simple platform built for modern farm operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate('/auth')} className="text-base rounded-xl px-8 h-12 shadow-lg shadow-primary/20">
                Start for Free
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/auth')} className="text-base rounded-xl px-8 h-12">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything you need to run your farm
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From task assignment to performance analytics, FarmFlow gives supervisors and students the tools they need.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-card">
                <CardContent className="p-7">
                  <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-5`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-10 sm:p-14 text-center relative z-10">
              <Sprout className="w-12 h-12 mx-auto mb-6 opacity-90" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to streamline your farm?</h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg mx-auto">
                Join FarmFlow today and experience the easiest way to manage tasks, track time, and boost productivity.
              </p>
              <Button size="lg" variant="secondary" onClick={() => navigate('/auth')} className="text-base rounded-xl px-8 h-12 font-semibold">
                Create Your Account
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sprout className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">FarmFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} FarmFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
