import Link from "next/link"
import {
  Building2Icon,
  ChevronRightIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react"

import { logoutAction } from "@/app/actions/auth"
import { ProfileForm } from "@/components/settings/profile-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getProfile, getSessionUser } from "@/lib/data"

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>How you appear in the app and how months are counted.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank feeds</CardTitle>
          <CardDescription>
            Link your bank, sync accounts, and import transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="min-h-11 w-full justify-between" asChild>
            <Link href="/settings/banks">
              <Building2Icon data-icon="inline-start" aria-hidden />
              Manage bank connections
              <ChevronRightIcon
                className="text-muted-foreground"
                data-icon="inline-end"
                aria-hidden
              />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
          <CardDescription>
            Organise transactions by type with custom categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="min-h-11 w-full justify-between" asChild>
            <Link href="/settings/categories">
              <TagIcon data-icon="inline-start" aria-hidden />
              Manage categories
              <ChevronRightIcon
                className="text-muted-foreground"
                data-icon="inline-end"
                aria-hidden
              />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-categorise rules</CardTitle>
          <CardDescription>
            Match imported merchant names to categories automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="min-h-11 w-full justify-between" asChild>
            <Link href="/settings/rules">
              <SparklesIcon data-icon="inline-start" aria-hidden />
              Manage rules
              <ChevronRightIcon
                className="text-muted-foreground"
                data-icon="inline-end"
                aria-hidden
              />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <form action={logoutAction}>
        <Button type="submit" variant="destructive" className="min-h-11 w-full">
          Log out
        </Button>
      </form>
    </div>
  )
}
