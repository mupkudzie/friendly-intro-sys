import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, Loader2, Clock, Tag } from "lucide-react";

interface AITemplate {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  estimated_hours: number;
  requirements: string;
}

interface AITemplatesSuggestionsProps {
  templates: AITemplate[];
  isLoading: boolean;
  onGenerate: () => void;
  onSave: (template: AITemplate) => void;
  onDismiss: (title: string) => void;
  onUseTemplate?: (template: AITemplate) => void;
}

export function AITemplatesSuggestions({
  templates,
  isLoading,
  onGenerate,
  onSave,
  onDismiss,
  onUseTemplate,
}: AITemplatesSuggestionsProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Generated Templates
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Learning...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Generate from Tasks
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI learns from completed tasks to suggest reusable templates
        </p>
      </CardHeader>
      <CardContent>
        {templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card key={template.title} className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{template.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => onDismiss(template.title)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {template.category}
                    </Badge>
                    <Badge className={`text-xs ${getPriorityColor(template.priority)}`}>
                      {template.priority}
                    </Badge>
                    {template.estimated_hours > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {template.estimated_hours}h
                      </Badge>
                    )}
                  </div>

                  {template.requirements && (
                    <p className="text-xs text-muted-foreground mb-3">
                      <span className="font-medium">Requirements:</span> {template.requirements}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onSave(template)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Save as Template
                    </Button>
                    {onUseTemplate && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => onUseTemplate(template)}
                      >
                        Use Now
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No AI suggestions yet</p>
            <p className="text-xs">Click "Generate from Tasks" to analyze completed tasks and create templates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
