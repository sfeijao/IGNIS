import dynamic from 'next/dynamic'

const VerificationConfig = dynamic(() => import('@/components/VerificationConfig'), { ssr: false })

export default function VerificationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Verificação</h1>
      <VerificationConfig />
    </div>
  )
}
