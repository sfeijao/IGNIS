import GuildAssets from '@/components/GuildAssets';

export const metadata = {
  title: 'Guild Assets - IGNIS Dashboard',
  description: 'Upload custom avatar and banner for your server'
};

export default function GuildAssetsPage({ params }: { params: { gid: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <GuildAssets guildId={params.gid} />
    </div>
  );
}
