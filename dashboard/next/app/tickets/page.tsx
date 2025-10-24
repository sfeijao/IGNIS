import dynamic from 'next/dynamic'

const TicketsList = dynamic(() => import('@/components/TicketsList'), { ssr: false })

export default function TicketsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tickets</h1>
      <TicketsList />
    </div>
  )
}
