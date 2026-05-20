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
  const [supervisorCode, setSupervisorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSupervisor, setShowSupervisor] = useState(false);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .eq('role', 'supervisor')
      .eq('active', true);
    
    if (data && data.length > 0) {
      setSupervisorCode(data[0].code);
    }
  };

  const saveCode = async (code: string) => {
    if (!code.trim() || !userProfile) return;
    setLoading(true);

    try {
      // Deactivate existing code for supervisor
      await supabase
        .from('access_codes')
        .update({ active: false } as any)
        .eq('role', 'supervisor')
        .eq('active', true);

      // Insert new code
      const { error } = await supabase
        .from('access_codes')
        .insert({
          code: code.trim(),
          role: 'supervisor',
          created_by: userProfile.user_id,
          active: true,
        } as any);

      if (error) throw error;
      toast.success(`Supervisor access code updated!`);
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
          Registration Access Code
        </CardTitle>
        <CardDescription>
          Set the access code required for Supervisor registration. Share this code only with authorized personnel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            <Button onClick={() => saveCode(supervisorCode)} disabled={loading || !supervisorCode.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Farm Workers can register freely without an access code. Only Supervisor registration requires an access code.
        </p>
      </CardContent>
    </Card>
  );
}
