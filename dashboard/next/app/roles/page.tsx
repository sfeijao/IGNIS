import dynamic from 'next/dynamic'

const RolesManager = dynamic(() => import('@/components/RolesManager'), { ssr: false })

export default function RolesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cargos</h1>
      <RolesManager />
    </div>
  )
}
