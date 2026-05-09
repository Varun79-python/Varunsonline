import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Varun's Online — Local Shopping Delivered",
  description: 'Order from your favourite local shops. Fast delivery to your doorstep.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
