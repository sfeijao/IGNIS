import ServerStats from '@/components/ServerStats';

export const metadata = {
  title: 'Server Stats - IGNIS Dashboard',
  description: 'Configurar canais dinâmicos de estatísticas do servidor'
};

export default function ServerStatsPage({ params }: { params: { gid: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900">
      <ServerStats guildId={params.gid} />
    </div>
  );
}
