// Server-side layout for /giveaways/[id]
// Adds a minimal wrapper and provides a generateStaticParams() stub
// so static export builds (if enabled) won't fail due to missing params.

export default function GiveawayIdLayout({ children }: { children: React.ReactNode }) {
  return children as any;
}

// Empty list means we don't pre-render any specific IDs at build time.
// This is safe even when using server/standalone output.
export async function generateStaticParams() {
  return [] as Array<{ id: string }>;
}
