import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, 
  CheckCircle, XCircle, Lightbulb, Award, AlertCircle, 
  RefreshCw, Loader2, BarChart3, Users, Clock, Target
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useAIPerformanceInsights, PerformanceInsights } from '@/hooks/useAIPerformanceInsights';
import { cn } from '@/lib/utils';

export function AIPerformanceDashboard() {
  const { insights, isLoading, fetchInsights } = useAIPerformanceInsights();

  useEffect(() => {
    fetchInsights();
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getInsightBg = (type: string) => {
    switch (type) {
      case 'positive': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'critical': return 'bg-red-50 border-red-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (isLoading && !insights) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">AI is analyzing performance data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Performance Analytics</CardTitle>
                <CardDescription>
                  AI-powered insights and recommendations for workforce optimization
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => fetchInsights()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Analysis
            </Button>
          </div>
        </CardHeader>
      </Card>

      {insights && (
        <>
          {/* Health Score & Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="md:col-span-1">
              <CardContent className="p-6 text-center">
                <div className={cn("text-5xl font-bold mb-2", getHealthColor(insights.overallHealthScore))}>
                  {insights.overallHealthScore}
                </div>
                <div className="text-sm text-muted-foreground mb-2">Health Score</div>
                <Progress 
                  value={insights.overallHealthScore} 
                  className="h-2"
                />
                <div className="flex items-center justify-center gap-2 mt-3">
                  {getTrendIcon(insights.productivityTrend)}
                  <span className="text-sm capitalize">{insights.productivityTrend}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{insights.rawStats?.totalCompleted || 0}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{insights.rawStats?.totalPending || 0}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{Math.round(insights.rawStats?.totalHours || 0)}</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </CardContent>
            </Card>
          </div>

          {/* Key Insights */}
          {insights.keyInsights && insights.keyInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {insights.keyInsights.map((insight, index) => (
                    <div 
                      key={index}
                      className={cn("p-3 rounded-lg border flex items-start gap-3", getInsightBg(insight.type))}
                    >
                      {getInsightIcon(insight.type)}
                      <div>
                        <div className="font-medium">{insight.title}</div>
                        <div className="text-sm text-muted-foreground">{insight.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Charts */}
            {insights.rawStats?.weeklyData && insights.rawStats.weeklyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Weekly Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={insights.rawStats.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="tasks" fill="#10b981" name="Tasks" />
                      <Bar dataKey="hours" fill="#3b82f6" name="Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.recommendations.map((rec, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getPriorityColor(rec.priority)}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <div className="font-medium text-sm">{rec.action}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Impact: {rec.impact}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            {insights.topPerformers && insights.topPerformers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.topPerformers.map((performer, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 text-green-700 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{performer.name}</div>
                          <div className="text-sm text-green-700">{performer.achievement}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Needs Attention */}
            {insights.needsAttention && insights.needsAttention.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.needsAttention.map((item, index) => (
                      <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-orange-700 mt-1">{item.issue}</div>
                        <div className="text-xs text-muted-foreground mt-2">
                          💡 {item.suggestion}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Weekly Forecast */}
          {insights.weeklyForecast && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Weekly Forecast</h3>
                    <p className="text-blue-800">{insights.weeklyForecast}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Worker Performance Table */}
          {insights.rawStats?.workerStats && insights.rawStats.workerStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Worker Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Worker</th>
                        <th className="text-center p-2">Completed</th>
                        <th className="text-center p-2">Pending</th>
                        <th className="text-center p-2">Hours</th>
                        <th className="text-center p-2">Score</th>
                        <th className="text-center p-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.rawStats.workerStats.map((worker, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{worker.name}</td>
                          <td className="text-center p-2">{worker.completedTasks}</td>
                          <td className="text-center p-2">{worker.pendingTasks}</td>
                          <td className="text-center p-2">{Math.round(worker.totalHours)}</td>
                          <td className="text-center p-2">
                            <Badge variant="outline">{worker.avgScore.toFixed(1)}/5</Badge>
                          </td>
                          <td className="text-center p-2">
                            <span className={cn(
                              "font-medium",
                              Number(worker.completionRate) >= 80 ? "text-green-600" :
                              Number(worker.completionRate) >= 50 ? "text-yellow-600" : "text-red-600"
                            )}>
                              {worker.completionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
