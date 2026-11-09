import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Čitaonica',
  description: 'Romani i priče — čitaj besplatno, podrži autore pretplatom.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
