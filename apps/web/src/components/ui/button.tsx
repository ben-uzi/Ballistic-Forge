import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-forge-500 text-gunmetal-950 hover:bg-forge-400 font-semibold shadow-sm shadow-black/40',
        secondary: 'bg-gunmetal-800 text-ink-100 hover:bg-gunmetal-700 border border-gunmetal-700',
        ghost: 'text-ink-300 hover:bg-gunmetal-800 hover:text-ink-100',
        outline:
          'border border-forge-600 text-forge-500 hover:bg-forge-500/10 hover:text-forge-400',
        danger: 'bg-fail-500/15 text-fail-500 border border-fail-500/40 hover:bg-fail-500/25',
      },
      size: {
        // Default clears the 44px gloves-on minimum (BUILD_BRIEF §4).
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-9 px-3 text-xs',
        lg: 'min-h-14 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps): React.ReactElement {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
