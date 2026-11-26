import './globals.css';
import './prototype.css';
import '../styles/terolibrary-screens.css';
import '../styles/mobile-reader-app.css';
import '../styles/design-system-v2.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f6f8' };

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
