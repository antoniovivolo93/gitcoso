import type { ButtonHTMLAttributes, ElementType } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ElementType;
  variant?: "default" | "primary" | "ghost";
};

export function Button({ icon: Icon, variant = "default", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variant === "default" && "border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]",
        variant === "primary" && "border-accent-violet/60 bg-accent-violet text-white hover:bg-violet-500",
        variant === "ghost" && "border-transparent bg-transparent text-slate-300 hover:bg-white/[0.08]",
        className
      )}
      {...props}
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
