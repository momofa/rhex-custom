import type { ReactNode } from "react"

import { ConfirmProvider } from "@/components/ui/alert-dialog"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>
}
