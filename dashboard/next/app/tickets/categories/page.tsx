import TicketCategoryManager from '@/components/TicketCategoryManager';

export const metadata = {
  title: 'Categorias de Tickets - IGNIS Dashboard',
  description: 'Gerir categorias de tickets do servidor'
};

export default function TicketCategoriesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <TicketCategoryManager />
    </div>
  );
}
