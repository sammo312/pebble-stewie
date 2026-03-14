import './globals.css'

export const metadata = {
  title: 'Pebble Screen Builder',
  description: 'Design and connect screens for Pebble watch apps'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
