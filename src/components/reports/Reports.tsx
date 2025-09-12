import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, X } from 'lucide-react';

interface TaskReport {
  id: string;
  original_report: string;
  refined_report: string | null;
  submitted_at: string;
  approved_at: string | null;
  task?: { title: string };
  profile?: { full_name: string };
}

interface ReportsProps {
  userRole: string;
}

export function Reports({ userRole }: ReportsProps) {
  const [reports, setReports] = useState<TaskReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('task_reports')
      .select(`
        *,
        task:tasks(title),
        profile:profiles(full_name)
      `)
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      setReports(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading reports...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Reports</h2>
        <Badge variant="secondary">{reports.length} reports</Badge>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground">No reports found</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {report.task?.title || 'Unknown Task'}
                  </CardTitle>
                  <Badge className={report.approved_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {report.approved_at ? 'Approved' : 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-1">Original Report:</h4>
                    <p className="text-sm bg-muted p-3 rounded-md">{report.original_report}</p>
                  </div>
                  {report.refined_report && (
                    <div>
                      <h4 className="font-medium mb-1">Refined Report:</h4>
                      <p className="text-sm bg-green-50 p-3 rounded-md">{report.refined_report}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Submitted by {report.profile?.full_name} on {new Date(report.submitted_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}