import { cn } from "../../lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/80 p-6 shadow-soft",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    <h3 className={cn("text-lg font-semibold text-text-primary", className)} {...props} />
  );
}

function CardDescription({ className, ...props }) {
  return (
    <p className={cn("text-sm text-text-muted", className)} {...props} />
  );
}

function CardContent({ className, ...props }) {
  return <div className={cn("pt-4", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn("pt-4", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
