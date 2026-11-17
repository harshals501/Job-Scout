import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Scout',
  description: 'A daily shortlist of roles worth your time, with drafts ready to edit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
