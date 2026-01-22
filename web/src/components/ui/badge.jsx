import { cn } from "../../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-muted text-text-primary",
    success: "bg-emerald-500/10 text-emerald-200",
    warning: "bg-amber-400/10 text-amber-200",
    info: "bg-blue-400/10 text-blue-200"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
