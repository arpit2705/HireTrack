import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1",
    "overflow-hidden rounded-full border border-transparent",
    "px-2 py-0.5 text-xs font-medium whitespace-nowrap",
    "font-jetbrains transition-all",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
    "[&>svg]:pointer-events-none [&>svg]:size-3!",
  ].join(" "),
  {
    variants: {
      variant: {
        // Generic
        default:   "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border-secondary",
        destructive:
          "bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/20 focus-visible:ring-[#EF4444]/20",
        outline:   "border-border text-foreground bg-transparent",
        ghost:     "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link:      "text-primary underline-offset-4 hover:underline",

        // Tag/chip — pale lavender bg, ink-indigo text, mono font (for candidate tags)
        tag: "bg-[#E8E6FF] text-[#14132B] border-[#C8C6E0]/60 font-jetbrains tracking-tight",

        // Pipeline status badges — dot + label
        "status-open":
          "bg-[#22C55E]/12 text-[#15803D] border-[#22C55E]/25 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#22C55E] before:content-['']",
        "status-draft":
          "bg-[#F59E0B]/12 text-[#92400E] border-[#F59E0B]/25 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#F59E0B] before:content-['']",
        "status-closed":
          "bg-[#6B6A80]/10 text-[#4B4A5E] border-[#6B6A80]/20 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#6B6A80] before:content-['']",

        // Interview statuses
        "status-scheduled":
          "bg-[#4F46E5]/10 text-[#3730A3] border-[#4F46E5]/25 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#4F46E5] before:content-['']",
        "status-completed":
          "bg-[#22C55E]/12 text-[#15803D] border-[#22C55E]/25 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#22C55E] before:content-['']",
        "status-cancelled":
          "bg-[#6B6A80]/10 text-[#4B4A5E] border-[#6B6A80]/20 before:mr-1 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#6B6A80] before:content-['']",

        // Role badges
        "role-admin":
          "bg-[#4F46E5]/10 text-[#3730A3] border-[#4F46E5]/20",
        "role-recruiter":
          "bg-[#E8E6FF] text-[#4B4A5E] border-[#C8C6E0]/60",
        "role-hiring-manager":
          "bg-[#F59E0B]/12 text-[#92400E] border-[#F59E0B]/25",

        // User status
        "user-active":
          "bg-[#22C55E]/12 text-[#15803D] border-[#22C55E]/25",
        "user-invited":
          "bg-[#F59E0B]/12 text-[#92400E] border-[#F59E0B]/25",
        "user-deactivated":
          "bg-[#6B6A80]/10 text-[#4B4A5E] border-[#6B6A80]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
