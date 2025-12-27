import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Wand2, Expand, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AITextButtonProps {
  isLoading: boolean;
  onImprove: () => void;
  onExpand?: () => void;
  showDropdown?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export function AITextButton({
  isLoading,
  onImprove,
  onExpand,
  showDropdown = false,
  className = '',
  size = 'sm',
}: AITextButtonProps) {
  if (isLoading) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled
        className={className}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (showDropdown && onExpand) {
    return (
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size={size}
                  className={`text-primary hover:text-primary/80 hover:bg-primary/10 ${className}`}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI Writing Assistant</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImprove}>
            <Wand2 className="h-4 w-4 mr-2" />
            Improve Writing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExpand}>
            <Expand className="h-4 w-4 mr-2" />
            Expand Text
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={size}
            onClick={onImprove}
            className={`text-primary hover:text-primary/80 hover:bg-primary/10 ${className}`}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Improve with AI</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
