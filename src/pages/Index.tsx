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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sprout className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-sm font-semibold tracking-wide text-slate-600 font-heading">Loading FarmFlow...</div>
          {showTimeout && (
            <div className="text-center text-sm text-muted-foreground slide-up">
              <p>Taking longer than expected...</p>
              <Button variant="link" onClick={() => setShowTimeout(false)} className="mt-2 text-primary font-medium">
                Try again
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
      description: 'Organize farm workers with role-based access, approvals, and real-time activity tracking.',
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400',
    },
    {
      icon: Sprout,
      title: 'Smart Task Assignment',
      description: 'Create, assign, and monitor farm tasks with templates, priorities, and AI-powered suggestions.',
      color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400',
    },
    {
      icon: Clock,
      title: 'Time & Attendance',
      description: 'Automated clock in/out with GPS verification, break tracking, and weekly timesheets.',
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'AI-refined reports, performance dashboards, and actionable insights for better decisions.',
      color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400',
    },
    {
      icon: MapPin,
      title: 'GPS Verification',
      description: 'Random location checks ensure workers are on-site with real-time supervisor alerts.',
      color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Role-based security, audit trails, and offline support keep your data safe and accessible.',
      color: 'bg-slate-50 text-slate-600 dark:bg-slate-950/20 dark:text-slate-400',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-x-hidden font-sans selection:bg-primary/20 selection:text-primary">
      {/* Decorative Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-teal-300/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-amber-200/10 blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-navbar shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl gradient-green flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Sprout className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 font-heading">
              Farm<span className="text-primary">Flow</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')} 
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-xl"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate('/auth')} 
              className="text-sm font-semibold rounded-xl px-5 h-10 gradient-green text-white shadow-md shadow-emerald-600/10 hover:shadow-xl hover:shadow-emerald-600/20 active-shrink transition-all duration-300"
            >
              Get Started
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-800 text-xs font-semibold mb-8 scale-in tracking-wider border border-emerald-500/20 uppercase">
            <Sprout className="w-3.5 h-3.5" />
            Next-Gen Farm Operations
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6 font-heading slide-up">
            Streamline Your Farm Tasks
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 mt-2">
              With Visual Precision
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed font-sans slide-up">
            Track timesheets, auto-verify GPS coordinates, manage field workers, and capture live progress photos — all integrated into one beautiful, easy-to-use platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center slide-up">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')} 
              className="w-full sm:w-auto text-base font-semibold rounded-2xl px-10 h-13 shadow-xl gradient-green text-white active-shrink transition-all duration-300"
            >
              Start for Free
              <ChevronRight className="w-5 h-5 ml-1.5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/auth')} 
              className="w-full sm:w-auto text-base font-semibold rounded-2xl px-10 h-13 border-slate-200 bg-white/70 hover:bg-slate-100 text-slate-700 hover:text-slate-900 active-shrink transition-all duration-300"
            >
              Explore Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4.5xl font-bold text-slate-900 mb-4 font-heading">
              Everything Needed to Run Your Fields
            </h2>
            <p className="text-slate-500 text-md sm:text-lg max-w-2xl mx-auto font-sans">
              From GPS-fenced check-ins to automated compliance checks, FarmFlow offers supervisors and workers complete synchronicity.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card 
                key={feature.title} 
                className="group border-0 glass-card p-1 hover-lift active-shrink transition-all duration-300"
              >
                <CardContent className="p-7">
                  <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-6 shadow-sm`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2.5 font-heading">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm font-sans">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white overflow-hidden relative rounded-3xl p-2">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[60px]" />
            <CardContent className="p-10 sm:p-16 text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                <Sprout className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl sm:text-3.5xl font-bold mb-4 font-heading tracking-tight">Ready to streamline your farm operations?</h2>
              <p className="text-slate-400 text-md mb-10 max-w-lg mx-auto font-sans leading-relaxed">
                Empower your workforce with automated timesheets, visual verification, and real-time updates.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')} 
                className="text-base rounded-2xl px-10 h-13 font-bold bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 active-shrink transition-all duration-300 shadow-lg shadow-black/30"
              >
                Create Your Account
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/50 py-10 px-6 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-green flex items-center justify-center shadow-md shadow-emerald-600/15">
              <Sprout className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 font-heading">
              Farm<span className="text-primary">Flow</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            © {new Date().getFullYear()} FarmFlow. All rights reserved. Designed for sustainable agricultural operations.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
