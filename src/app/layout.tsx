import './globals.css';
import { ReactNode } from 'react'; // 🚨 Import typu dla 'children'
// Możesz tu mieć importy fontów i meta danych...

// Deklarujemy, że 'children' musi być typu ReactNode, co rozwiązuje błąd typowania.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        {/* Kontener globalny */}
        {children}
      </body>
    </html>
  );
}