import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export const metadata: Metadata = {
  title: 'IGNIS Dashboard',
  description: 'Modern MEE6-like dashboard for IGNIS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950">
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <Topbar />
            <main className="px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
