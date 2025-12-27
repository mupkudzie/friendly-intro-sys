import { useState, useRef, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useSmartCompose } from '@/hooks/useSmartCompose';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  context?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export function SmartTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  context = '',
  className = '',
  id,
  required,
}: SmartTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  const { suggestion, isLoading, getSuggestion, acceptSuggestion, clearSuggestion } = useSmartCompose({
    context,
    debounceMs: 800,
    minChars: 20,
  });

  useEffect(() => {
    if (value && !disabled) {
      getSuggestion(value);
    } else {
      clearSuggestion();
    }
  }, [value, disabled, getSuggestion, clearSuggestion]);

  useEffect(() => {
    setShowSuggestion(!!suggestion && suggestion !== value);
  }, [suggestion, value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && showSuggestion && suggestion) {
      e.preventDefault();
      onChange(suggestion);
      clearSuggestion();
      setShowSuggestion(false);
    } else if (e.key === 'Escape') {
      clearSuggestion();
      setShowSuggestion(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={cn(
          "transition-all duration-200 focus:ring-2 focus:ring-primary/20",
          className
        )}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-3 bottom-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Suggestion preview */}
      {showSuggestion && suggestion && !isLoading && (
        <div className="mt-2 p-3 bg-muted/50 border border-dashed border-primary/30 rounded-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">
                AI Suggestion (press Tab to accept, Esc to dismiss):
              </p>
              <p className="text-sm text-foreground/80 line-clamp-3">{suggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
