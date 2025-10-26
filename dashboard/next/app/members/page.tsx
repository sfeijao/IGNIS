import dynamic from 'next/dynamic'

const MembersList = dynamic(() => import('@/components/MembersList'), { ssr: false })

export default function MembersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Membros</h1>
      <MembersList />
    </div>
  )
}
