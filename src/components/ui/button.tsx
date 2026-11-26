import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        // Flat fills, as in the design: yellow for the main action, coral for the secondary accent.
        default: "bg-primary text-primary-foreground hover:brightness-105",
        accent: "bg-accent text-accent-foreground hover:brightness-105",
        party: "bg-primary text-primary-foreground font-bold hover:brightness-105",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border-2 border-border bg-transparent hover:bg-secondary hover:border-primary/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary/70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        default: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-lg rounded-2xl",
        xl: "h-16 px-8 text-xl rounded-2xl",
        icon: "size-12",
        "icon-sm": "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
