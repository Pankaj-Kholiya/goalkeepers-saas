import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-brand to-brand-deep text-white shadow-sm shadow-brand-deep/25 hover:from-[#28A046] hover:to-[#2E6B2C] hover:shadow-md hover:shadow-brand-deep/30',
        secondary:
          'bg-accent-softer text-brand-deep hover:bg-[#f5d0fe]',
        outline:
          'border border-line bg-white text-ink hover:border-brand hover:bg-accent-soft hover:text-brand-deep',
        ghost: 'text-ink-subtle hover:bg-accent-soft hover:text-brand-deep',
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
