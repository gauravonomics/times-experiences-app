import type { Metadata } from 'next'
import { Work_Sans, Newsreader, Geist_Mono } from 'next/font/google'
import './globals.css'

const workSans = Work_Sans({
  variable: '--font-work-sans',
  subsets: ['latin'],
  display: 'swap',
})

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Times Experiences',
  description: "BCCL's event management platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${newsreader.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">{children}</body>
    </html>
  )
}
