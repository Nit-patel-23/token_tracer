import Link from 'next/link';

const STUDIES = [
  {
    href: '/admin/research/error-spikes',
    title: 'Error Spikes',
    desc: 'Daily tool-error-rate trend with rolling-baseline anomaly detection and per-tool root-cause drill-down.',
  },
  {
    href: '/admin/research/context-saturation',
    title: 'Context Saturation',
    desc: 'At what % of context window do tool-error rate and valid-tool-call rate start to degrade, per model.',
  },
  {
    href: '/admin/research/prompt-specificity',
    title: 'Prompt Specificity → Efficiency',
    desc: 'Does a specific prompt (code block, file path, traceback) reduce rework/revert rate vs a vague one?',
  },
  {
    href: '/admin/research/verbosity-elasticity',
    title: 'Verbosity Elasticity',
    desc: 'How output token volume scales with input size, per model and task intent.',
  },
  {
    href: '/admin/research/cost-performance',
    title: 'Cost / Performance Frontier',
    desc: 'Which models sit on the cost vs success-rate Pareto frontier, per task intent.',
  },
  {
    href: '/admin/research/redundant-reprompt',
    title: 'Redundant Re-prompting',
    desc: 'Cost wasted on near-duplicate re-prompts (pilot org only).',
  },
  {
    href: '/admin/research/daemon-cohorts',
    title: 'Daemon Cohorts',
    desc: 'Error rate grouped by daemon version — catches regressions introduced by a specific release.',
  },
];

export default function ResearchOverviewPage() {
  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Behavioral studies over synced agent sessions — why cost, error rate, and quality move the
        way they do. Every study shares the same range/org/tool/model filters.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand-dim hover:bg-wash"
          >
            <div className="text-sm font-medium text-ink">{s.title}</div>
            <div className="mt-1.5 text-xs leading-relaxed text-muted">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
