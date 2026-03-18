import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AccessCode {
  id: string;
  code: string;
  role: string;
  active: boolean;
}

export function AccessCodeManager() {
  const { userProfile } = useAuth();
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [adminCode, setAdminCode] = useState('');
  const [supervisorCode, setSupervisorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSupervisor, setShowSupervisor] = useState(false);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .eq('active', true);
    
    if (data) {
      setCodes(data as AccessCode[]);
      const admin = data.find((c: any) => c.role === 'admin');
      const supervisor = data.find((c: any) => c.role === 'supervisor');
      if (admin) setAdminCode(admin.code);
      if (supervisor) setSupervisorCode(supervisor.code);
    }
  };

  const saveCode = async (role: 'admin' | 'supervisor', code: string) => {
    if (!code.trim() || !userProfile) return;
    setLoading(true);

    try {
      // Deactivate existing code for this role
      await supabase
        .from('access_codes')
        .update({ active: false } as any)
        .eq('role', role)
        .eq('active', true);

      // Insert new code
      const { error } = await supabase
        .from('access_codes')
        .insert({
          code: code.trim(),
          role,
          created_by: userProfile.user_id,
          active: true,
        } as any);

      if (error) throw error;
      toast.success(`${role === 'admin' ? 'Admin' : 'Supervisor'} access code updated!`);
      fetchCodes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save access code');
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Registration Access Codes
        </CardTitle>
        <CardDescription>
          Set access codes required for Admin and Supervisor registration. Share these codes only with authorized personnel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Admin Access Code */}
        <div className="space-y-3 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">Admin Access Code</Label>
              <Badge variant="destructive" className="text-xs">High Security</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showAdmin ? 'text' : 'password'}
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Set admin access code"
              />
              <button
                type="button"
                onClick={() => setShowAdmin(!showAdmin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAdmin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAdminCode(generateCode())}
              title="Generate random code"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => saveCode('admin', adminCode)} disabled={loading || !adminCode.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Supervisor Access Code */}
        <div className="space-y-3 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">Supervisor Access Code</Label>
              <Badge variant="secondary" className="text-xs">Moderate Security</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showSupervisor ? 'text' : 'password'}
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value)}
                placeholder="Set supervisor access code"
              />
              <button
                type="button"
                onClick={() => setShowSupervisor(!showSupervisor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSupervisor ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSupervisorCode(generateCode())}
              title="Generate random code"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => saveCode('supervisor', supervisorCode)} disabled={loading || !supervisorCode.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Farm Workers can register freely without an access code. Only Admin and Supervisor roles require a code.
        </p>
      </CardContent>
    </Card>
  );
}
