import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        pinGlobal:
          "bg-rose-100 text-rose-700 [a]:hover:bg-rose-100/80 dark:bg-rose-500/15 dark:text-rose-200",
        pinZone:
          "bg-orange-100 text-orange-700 [a]:hover:bg-orange-100/80 dark:bg-orange-500/15 dark:text-orange-200",
        pinBoard:
          "bg-amber-100 text-amber-700 [a]:hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-200",
        auction:
          "bg-amber-100 text-amber-700 [a]:hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-200",
        lottery:
          "bg-rose-100 text-rose-700 [a]:hover:bg-rose-100/80 dark:bg-rose-500/15 dark:text-rose-200",
        poll:
          "bg-sky-100 text-sky-700 [a]:hover:bg-sky-100/80 dark:bg-sky-500/15 dark:text-sky-200",
        bounty:
          "bg-emerald-100 text-emerald-700 [a]:hover:bg-emerald-100/80 dark:bg-emerald-500/15 dark:text-emerald-200",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
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
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
