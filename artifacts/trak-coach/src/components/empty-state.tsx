import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 gap-3 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-[260px]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
