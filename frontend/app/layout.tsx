import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Quiz Musical',
  description: 'Quiz musical - Next.js 13 App Router + Tailwind',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  )
}