import { MobileShell } from "@/components/layout/mobile-shell"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MobileShell>{children}</MobileShell>
}
