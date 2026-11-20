import './globals.css';
import './prototype.css';
import '../styles/terolibrary-screens.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'terolibrary',
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
