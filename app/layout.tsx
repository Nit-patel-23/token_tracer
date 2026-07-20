import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Visualisation Dashboard — cross-agent intelligence',
  description:
    'Cross-agent intelligence dashboard for Claude Code, Codex, Cursor, OpenClaw, and Hermes — API-equivalent cost, code impact, workflow quality, and read-only session trajectories.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
