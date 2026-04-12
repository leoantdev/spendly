import { CategoryManager } from "@/components/categories/category-manager"
import { Card, CardContent } from "@/components/ui/card"
import { getCategories, getSessionUser } from "@/lib/data"

export default async function SettingsCategoriesPage() {
  const user = await getSessionUser()
  if (!user) return null

  const categories = await getCategories()

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Card>
        <CardContent className="pt-6">
          <CategoryManager categories={categories} />
        </CardContent>
      </Card>
    </div>
  )
}
