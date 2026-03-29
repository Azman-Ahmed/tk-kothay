import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", size = "default", ...props }) {
  const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-emerald-600",
    secondary: "bg-muted text-foreground hover:bg-slate-200 dark:hover:bg-slate-800",
    danger: "bg-destructive text-destructive-foreground hover:bg-rose-600",
    ghost: "hover:bg-muted text-foreground",
    outline: "border border-border hover:bg-muted text-foreground"
  };

  const sizes = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md",
    icon: "h-10 w-10"
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
