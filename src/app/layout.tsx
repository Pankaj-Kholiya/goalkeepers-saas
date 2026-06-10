import type { Metadata, Viewport } from 'next'
import { Source_Sans_3, Poppins } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/toast'

// Source Sans 3 (variable, used bold) for headings; Poppins (medium) for body
// + subtext — the GoalKeepers brand pairing.
const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GoalKeepers - quiz events for schools',
  description:
    'Run quiz events, leaderboards and badges for your school. Multi-tenant quiz platform.',
}

export const viewport: Viewport = {
  themeColor: '#4BA547',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
