import { Button } from "@/components/ui/button";

export function QueryErrorState({
  message = "Couldn't load this. This is usually temporary.",
  onRetry,
  isRetrying,
  testId = "button-retry",
  className = "py-12",
}: {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button
        size="sm"
        variant="outline"
        disabled={isRetrying}
        onClick={onRetry}
        data-testid={testId}
      >
        {isRetrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
