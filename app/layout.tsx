import './globals.css';
import '../styles/bookverse.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Čitaonica',
  description: 'Romani i priče — čitaj besplatno, podrži autore pretplatom.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>
        <a href="#main" className="skip-link">Preskoči na sadržaj</a>
        {children}
      </body>
    </html>
  );
}
