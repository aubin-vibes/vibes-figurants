import './globals.css';

export const metadata = {
  title: 'VIBES — Autorisations figurants',
  description: 'Inscription et autorisations de droit à l\u2019image',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
