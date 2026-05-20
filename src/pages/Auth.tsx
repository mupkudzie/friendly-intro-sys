import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Leaf, Mail, Lock, User, Phone, ArrowLeft, AlertCircle, KeyRound, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [role, setRole] = useState<'garden_worker' | 'supervisor' | 'admin'>('garden_worker');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, [searchParams]);

  const [showEmailVerificationReminder, setShowEmailVerificationReminder] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const requiresAccessCode = role === 'admin' || role === 'supervisor';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        toast.error(error.message);
        return;
      }

      if (authData.user && !authData.user.email_confirmed_at) {
        setUnverifiedEmail(authData.user.email || email);
        setShowEmailVerificationReminder(true);
        await supabase.auth.signOut();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('user_id', authData.user?.id)
        .single();

      if (profile?.approval_status === 'pending') {
        await supabase.auth.signOut();
        setError('Your account is being reviewed. You will receive an email notification once approved.');
        toast.error('Account under review');
        return;
      }

      if (profile?.approval_status === 'rejected') {
        await supabase.auth.signOut();
        setError('Your registration was not approved. Please check your email for details or contact the administrator.');
        toast.error('Registration not approved');
        return;
      }

      toast.success('Signed in successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unverifiedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } catch (err) {
      toast.error('Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (requiresAccessCode) {
        const roleToCheck = role === 'admin' ? 'admin' : 'supervisor';
        const { data: isValid, error: codeError } = await supabase
          .rpc('verify_access_code', { _code: accessCode, _role: roleToCheck });

        if (codeError || !isValid) {
          setError(`Invalid access code for ${roleToCheck} registration. Please contact an administrator.`);
          toast.error('Invalid access code');
          setLoading(false);
          return;
        }
      }

      const redirectUrl = `${window.location.origin}/`;
      const dbRole = role;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: dbRole,
            contact_number: contactNumber,
          },
        },
      });

      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        toast.success('Account created! You will receive an email once your account is approved.');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const redirectUrl = `${window.location.origin}/auth?type=recovery`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        toast.success('Password reset email sent! Check your inbox.');
        setShowForgotPassword(false);
        setResetEmail('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      toast.error('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully! You can now sign in.');
        setShowResetPassword(false);
        setNewPassword('');
        setConfirmPassword('');
        navigate('/auth', { replace: true });
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Desktop Visual Left Pane */}
      <div className="hidden md:flex md:w-[45%] lg:w-[40%] bg-slate-950 p-12 flex-col justify-between relative overflow-hidden text-white border-r border-slate-800">
        {/* Glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />
        
        {/* Top Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl gradient-green flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/20">
            <Leaf className="w-5.5 h-5.5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight font-heading">
            Farm<span className="text-emerald-400">Flow</span>
          </span>
        </div>

        {/* Content Body */}
        <div className="space-y-6 relative z-10 my-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-wide uppercase border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Enterprise Agricultural Hub
          </div>
          <h2 className="text-3xl lg:text-4.5xl font-extrabold leading-tight tracking-tight font-heading">
            Smart Management for Modern Fields.
          </h2>
          <p className="text-slate-400 leading-relaxed text-sm lg:text-base">
            Join the platform designed to coordinate workers, track attendance, and log GPS check-ins with absolute precision.
          </p>
          <div className="pt-4 flex flex-col gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Secured with role-based access control</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <span>Authorized entry via digital access codes</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500 relative z-10">
          © {new Date().getFullYear()} FarmFlow. Secure system portal.
        </div>
      </div>

      {/* Main Authentication Right Pane */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-16 relative">
        {/* Mobile decorative blobs */}
        <div className="md:hidden absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />
        <div className="md:hidden absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-[420px] scale-in">
          {/* Mobile logo header */}
          <div className="md:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-2.5">
              <div className="w-10 h-10 rounded-xl gradient-green flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <Leaf className="w-5.5 h-5.5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">
                Farm<span className="text-primary">Flow</span>
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-sans">Smart Farm Task Management</p>
          </div>

          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-md rounded-2xl relative overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-900 font-heading">Portal Login</CardTitle>
              <CardDescription className="text-slate-500">Sign in to your farm workplace</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-slate-100/80 rounded-xl">
                  <TabsTrigger 
                    value="signin" 
                    className="rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    className="rounded-lg text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                {/* Sign In Form */}
                <TabsContent value="signin" className="slide-up">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="name@farm.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-password" className="text-xs font-semibold text-slate-700">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="rounded-xl py-2 px-3.5 border-red-200 bg-red-50 text-red-900">
                        <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                        <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full h-11 rounded-xl text-sm font-bold gradient-green text-white shadow-md shadow-emerald-500/10 active-shrink transition-all duration-200" 
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Signing in...</span>
                        </div>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                    
                    <div className="text-center mt-3">
                      <button
                        type="button"
                        onClick={() => { setError(''); setShowForgotPassword(true); }}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </form>
                </TabsContent>

                {/* Sign Up Form */}
                <TabsContent value="signup" className="slide-up">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="e.g. John Doe"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="john@farm.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Min. 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-role" className="text-xs font-semibold text-slate-700">Select Role</Label>
                      <Select value={role} onValueChange={(value: any) => setRole(value)}>
                        <SelectTrigger className="h-10.5 rounded-xl border-slate-200 focus:ring-primary bg-white/50 text-slate-700">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          <SelectItem value="garden_worker">Farm Worker</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {requiresAccessCode && (
                      <div className="space-y-1.5 scale-in">
                        <Label htmlFor="signup-access-code" className="text-xs font-semibold text-slate-700">Access Verification Code</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="signup-access-code"
                            type="password"
                            placeholder="Enter validation code"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary bg-white/50"
                            required
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Requires a registration access code provided by system administrator.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-contact" className="text-xs font-semibold text-slate-700">Contact Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="signup-contact"
                          type="tel"
                          placeholder="e.g. +27821234567"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          className="pl-10 h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-primary bg-white/50"
                        />
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="rounded-xl py-2 px-3.5 border-red-200 bg-red-50 text-red-900">
                        <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                        <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full h-11 rounded-xl text-sm font-bold gradient-green text-white shadow-md shadow-emerald-500/10 active-shrink transition-all duration-200" 
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Creating account...</span>
                        </div>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Forgot Password Dialog */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <Card className="w-full max-w-md border-0 shadow-2xl rounded-2xl bg-white scale-in">
              <CardHeader className="relative">
                <CardTitle className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                  <button
                    onClick={() => { setError(''); setShowForgotPassword(false); }}
                    className="hover:bg-slate-100 rounded-lg p-1 text-slate-500 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  Reset Password
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="john@farm.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10 h-10.5 rounded-xl border-slate-200"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="rounded-xl py-2 px-3.5">
                      <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                      <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-11 rounded-xl text-sm font-bold gradient-green text-white active-shrink shadow-md shadow-emerald-500/10" 
                    disabled={loading}
                  >
                    {loading ? 'Sending link...' : 'Send Reset Link'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reset Password Form */}
        {showResetPassword && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md border-0 shadow-2xl rounded-2xl bg-white scale-in">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900 font-heading">Set New Password</CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  Enter your new password below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 h-10.5 rounded-xl border-slate-200"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Re-type password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-10.5 rounded-xl border-slate-200"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="rounded-xl py-2 px-3.5">
                      <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                      <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-11 rounded-xl text-sm font-bold gradient-green text-white active-shrink shadow-md shadow-emerald-500/10" 
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Verification Reminder */}
        {showEmailVerificationReminder && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md border-0 shadow-2xl rounded-2xl bg-white scale-in">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Email Not Verified
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  Please verify your email address before signing in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-amber-200 bg-amber-50 rounded-xl">
                  <Mail className="h-4 w-4 text-amber-600 shrink-0" />
                  <AlertDescription className="text-xs text-amber-800 font-medium">
                    We sent a verification email to <strong>{unverifiedEmail}</strong>. 
                    Please check your inbox and click the verification link to activate your account.
                  </AlertDescription>
                </Alert>
                
                <div className="text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-600">Didn't receive the email?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you entered the correct email address</li>
                    <li>Wait a few minutes and try again</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    onClick={handleResendVerificationEmail} 
                    disabled={loading}
                    className="w-full h-10.5 rounded-xl font-bold gradient-green text-white shadow-md"
                  >
                    {loading ? 'Sending...' : 'Resend Verification Email'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEmailVerificationReminder(false)}
                    className="w-full h-10.5 rounded-xl text-slate-600 font-semibold border-slate-200"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
