import { CategoryRulesManager } from "@/components/categories/category-rules-manager"
import { Card, CardContent } from "@/components/ui/card"
import { getCategories, getCategoryRules, getSessionUser } from "@/lib/data"

export default async function SettingsRulesPage() {
  const user = await getSessionUser()
  if (!user) return null

  const [categories, categoryRules] = await Promise.all([
    getCategories(),
    getCategoryRules(),
  ])

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Card>
        <CardContent className="pt-6">
          <CategoryRulesManager rules={categoryRules} categories={categories} />
        </CardContent>
      </Card>
    </div>
  )
}
