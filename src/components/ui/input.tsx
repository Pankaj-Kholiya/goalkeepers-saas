import * as React from 'react'

import { cn } from '@/lib/cn'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-1 text-sm text-[#1B1F23] shadow-sm outline-none focus-visible:border-[#C04ACD] focus-visible:ring-2 focus-visible:ring-[#C04ACD]/30 disabled:opacity-50 placeholder:text-[#94a3b8]',
        className
      )}
      {...props}
    />
  )
}

export { Input }
