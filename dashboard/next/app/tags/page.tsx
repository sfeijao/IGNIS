import dynamic from 'next/dynamic'

const QuickTagsManager = dynamic(() => import('@/components/QuickTagsManager'), { ssr: false })

export default function TagsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tags rápidas</h1>
      <QuickTagsManager />
    </div>
  )
}
