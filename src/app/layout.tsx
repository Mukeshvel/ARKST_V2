import type { Metadata } from 'next';
import { parseEnvironment } from '@/config/env';
import './globals.css';

const config = parseEnvironment(process.env);
export const metadata: Metadata = {
  metadataBase: new URL(config.appOrigin),
  title: 'ARKST | Foundation',
  description:
    'Academic operations application — identity foundation, no academic workflows.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
