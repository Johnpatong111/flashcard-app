import './globals.css';
import { ReactNode } from 'react'; // 🚨 MUSI BYĆ

export default function RootLayout({ children }: { children: ReactNode }) { // 🚨 MUSI BYĆ TAK ZAPISANE
  return (
    <html lang="pl">
      <body>
        {children}
      </body>
    </html>
  );
}
