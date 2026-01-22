import { forwardRef } from "react";

import { cn } from "../../lib/utils";

const Button = forwardRef(function Button(
  { className, variant = "default", size = "md", ...props },
  ref
) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "bg-transparent text-text-muted hover:bg-muted",
    outline: "border border-border text-text-primary hover:bg-muted"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

export { Button };
