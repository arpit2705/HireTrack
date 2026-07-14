import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "h-9 w-full min-w-0 rounded-xl border bg-white px-3 py-2",
        "text-base text-foreground transition-all duration-150 outline-none",
        // Border
        "border-[#E3E1F5]",
        // Placeholder
        "placeholder:text-muted-foreground/60 placeholder:font-normal",
        // Focus — coral ring (per design spec for form controls)
        "focus-visible:border-[#FF7A59] focus-visible:ring-3 focus-visible:ring-[#FF7A59]/20 focus-visible:bg-[#FFFAF8]",
        // File input
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F0F0ED] disabled:opacity-50",
        // Invalid
        "aria-invalid:border-[#EF4444] aria-invalid:ring-3 aria-invalid:ring-[#EF4444]/20",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
