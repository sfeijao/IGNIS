import AppealsManager from '@/components/AppealsManager'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <AppealsManager />
    </div>
  )
}
