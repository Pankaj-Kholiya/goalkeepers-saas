import * as React from 'react'

import { cn } from '@/lib/cn'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-[#C04ACD] focus-visible:ring-2 focus-visible:ring-[#C04ACD]/30 disabled:opacity-50 placeholder:text-[#94a3b8]',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
