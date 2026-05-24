import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'World Cup Simulator 2026',
  description: 'Production scaffold for the World Cup Simulator app.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
