import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkerRecommendation {
  user_id: string;
  full_name: string;
  reason: string;
  score: number;
}

interface WorkerRecommendationsProps {
  recommendations: WorkerRecommendation[];
  isLoading: boolean;
  onSelectWorker: (userId: string) => void;
  onGetRecommendations: () => void;
  disabled?: boolean;
}

export function WorkerRecommendations({
  recommendations,
  isLoading,
  onSelectWorker,
  onGetRecommendations,
  disabled = false,
}: WorkerRecommendationsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-orange-600 bg-orange-100";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Worker Recommendations
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGetRecommendations}
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="h-3 w-3 mr-1" />
              Get Recommendations
            </>
          )}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="grid gap-2">
          {recommendations.map((rec, index) => (
            <Card
              key={rec.user_id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                index === 0 && "ring-2 ring-primary/20"
              )}
              onClick={() => onSelectWorker(rec.user_id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rec.full_name}</span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Top Pick
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {rec.reason}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-xs", getScoreColor(rec.score))}>
                    {rec.score}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && recommendations.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Enter task title and description, then click "Get Recommendations" to see AI-suggested workers.
        </p>
      )}
    </div>
  );
}
