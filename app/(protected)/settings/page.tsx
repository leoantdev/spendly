import { logoutAction } from "@/app/actions/auth"
import { CategoryManager } from "@/components/categories/category-manager"
import { ProfileForm } from "@/components/settings/profile-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getCategories, getProfile, getSessionUser } from "@/lib/data"

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const categories = await getCategories()

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
        <CardContent className="pt-6">
          <CategoryManager categories={categories} />
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
