import type { Metadata, Viewport } from 'next'
import './globals.css'

// viewport must be a SEPARATE export in Next.js 13+ (not inside metadata)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
}

export const metadata: Metadata = {
  title: "Varun's Online — Local Shopping App",
  description: "Order from your favourite local shops in Vizag & nearby cities. Fast delivery to your doorstep. Groceries, Restaurants, Bakery and more.",
  keywords: ["local shopping", "online delivery", "Vizag", "Varun's Online", "grocery delivery", "restaurant delivery"],
  authors: [{ name: "Varun's Online" }],
  creator: "Varun's Online",
  publisher: "Varun's Online",
  metadataBase: new URL('https://www.varunsonline.com'),
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: "Varun's Online — Local Shopping App",
    description: "Order from your favourite local shops. Fast delivery to your doorstep.",
    url: 'https://www.varunsonline.com',
    siteName: "Varun's Online",
    images: [
      {
        url: '/logo.png',
        width: 1024,
        height: 1024,
        alt: "Varun's Online — Local Shopping App",
      }
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Varun's Online — Local Shopping App",
    description: "Order from your favourite local shops. Fast delivery to your doorstep.",
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="shortcut icon" href="/logo.png" />
        <script dangerouslySetInnerHTML={{
          __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`
        }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
