import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C04ACD]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-[#C04ACD] to-[#7E2D8E] text-white hover:from-[#a23eb0] hover:to-[#6a2278] shadow-md',
        outline:
          'border border-[#e5e7eb] bg-white hover:border-[#C04ACD] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
        ghost: 'hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
        destructive: 'bg-[#dc2626] text-white hover:bg-[#b91c1c]',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9',
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
