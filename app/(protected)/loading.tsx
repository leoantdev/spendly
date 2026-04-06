import { Skeleton } from "@/components/ui/skeleton"

export default function ProtectedLoading() {
  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
