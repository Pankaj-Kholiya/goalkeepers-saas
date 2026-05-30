import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-[#fdf4ff] text-[#7E2D8E]',
        success: 'bg-[#dcfce7] text-[#166534]',
        warning: 'bg-[#fef3c7] text-[#92400e]',
        neutral: 'bg-[#f1f5f9] text-[#64748b]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
