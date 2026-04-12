import { SettingsSubNav } from "@/components/settings/settings-sub-nav"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsSubNav />
      {children}
    </>
  )
}
