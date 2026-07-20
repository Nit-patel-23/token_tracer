import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Visualisation Dashboard — cross-agent intelligence',
  description:
    'Cross-agent intelligence dashboard for Claude Code, Codex, Cursor, OpenClaw, and Hermes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/team/team.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
