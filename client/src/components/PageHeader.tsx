import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  back?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, back, className }: PageHeaderProps) {
  return (
    <div className={cn("pb-4 border-b border-border-strong", className)}>
      {back && <div className="mb-3">{back}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-medium text-text-primary leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-text-secondary mt-1">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
