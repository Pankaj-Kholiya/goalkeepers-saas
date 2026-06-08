import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Design system: solid Leaf-Green CTA, no gradient.
        default:
          'bg-brand text-white shadow-sm shadow-[#1c2955]/10 hover:bg-brand-deep',
        // Deep Navy heavy action.
        navy: 'bg-navy text-white hover:bg-[#0f1838]',
        // Secondary = white card with a gray hairline + navy label.
        secondary:
          'border border-gray/70 bg-white text-navy hover:bg-accent-soft',
        outline:
          'border border-line bg-white text-navy hover:border-brand hover:bg-accent-soft hover:text-brand-deep',
        ghost: 'text-navy hover:bg-accent-soft',
        destructive: 'bg-[#dc2626] text-white shadow-sm hover:bg-[#b91c1c]',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
