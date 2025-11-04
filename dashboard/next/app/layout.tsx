import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import GuildHero from '@/components/GuildHero'
import { Poppins } from 'next/font/google'
import { ToasterProvider } from '@/components/Toaster'

export const metadata: Metadata = {
  title: 'IGNIS Dashboard',
  description: 'Modern MEE6-like dashboard for IGNIS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700'] })
  return (
    <html lang="en" className="dark">
      <body className={`min-h-screen bg-neutral-950 ${poppins.className}`}>
        <ToasterProvider>
          <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Topbar />
              {/* Server banner hero, shown when a guild is selected */}
              <GuildHero />
              <main className="px-4 sm:px-6 lg:px-8 py-6">
                {children}
              </main>
            </div>
          </div>
        </ToasterProvider>
      </body>
    </html>
  )
}
