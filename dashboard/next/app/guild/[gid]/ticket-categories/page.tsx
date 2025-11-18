import TicketCategoryManager from '@/components/TicketCategoryManager';

export const metadata = {
  title: 'Categorias de Tickets - IGNIS Dashboard',
  description: 'Gere categorias customizáveis de tickets'
};

export default function TicketCategoriesPage({ params }: { params: { gid: string } }) {
  return (
    <div className="container mx-auto p-6">
      <TicketCategoryManager guildId={params.gid} />
    </div>
  );
}
