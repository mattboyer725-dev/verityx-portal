import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40",
  {
    variants: {
      variant: {
        primary: "bg-paper text-ink hover:opacity-90",
        ghost: "border border-line bg-transparent text-paper hover:bg-raised",
        danger: "border border-bad/40 bg-transparent text-bad hover:bg-bad/10",
        quiet: "text-mute hover:text-paper",
      },
      size: {
        md: "h-11 rounded-[8px] px-4 text-sm",
        sm: "h-9 rounded-[8px] px-3 text-sm",
        lg: "h-12 rounded-[12px] px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
