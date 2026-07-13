import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { subpageMetadata } from '@/lib/subpage-metadata';

const STATUS_TITLE = 'Status · livediagram';
const STATUS_DESCRIPTION =
  'Operational status of the livediagram services: editor, API, realtime room, marketing site, telemetry dashboard, help centre, and database.';

export const metadata = subpageMetadata({
  title: STATUS_TITLE,
  description: STATUS_DESCRIPTION,
  path: '/status',
});

// Lightweight first-party status page. v1 is intentionally a static
// snapshot of the architecture (one row per Cloudflare Worker / D1
// binding the product depends on) rather than a live health probe:
// every service is fronted by Cloudflare's global edge so the most
// honest "is it up" signal is whether the marketing site you're
// reading right now loaded. If a real incident lands we can edit
// this page in the same PR that fixes it, the same way a hosted
// status board would mark "Investigating" / "Resolved" notices. A
// later iteration can swap the placeholder dots for client-side
// pings against /api/health and the router-worker root, but that's
// a separate spec, not v1.

type Component = { name: string; description: string };

const COMPONENTS: Component[] = [
  {
    name: 'Marketing site',
    description:
      'The public landing site at https://livediagram.app/. Static assets served by a Cloudflare Worker.',
  },
  {
    name: 'Editor (live app)',
    description:
      'The diagram editor at https://livediagram.app/new. Static export served by a Cloudflare Worker.',
  },
  {
    name: 'Telemetry dashboard',
    description:
      'The public anonymous-events dashboard at https://livediagram.app/telemetry. Static export served by a Cloudflare Worker.',
  },
  {
    name: 'Help centre',
    description:
      'The help centre at https://livediagram.app/help. Static export served by a Cloudflare Worker.',
  },
  {
    name: 'API',
    description:
      'The backend at https://livediagram.app/api. A Cloudflare Worker that owns the D1 binding.',
  },
  {
    name: 'Realtime room',
    description:
      'Per-diagram Durable Object that brokers cursor / selection / log ops. Lives inside the API Worker.',
  },
  {
    name: 'Database',
    description:
      'Cloudflare D1 (SQLite at the edge). Holds diagrams, tabs, change logs, share links, telemetry events.',
  },
  {
    name: 'Image storage',
    description:
      'Cloudflare R2. Stores uploaded image blobs (content-addressed, indexed in D1) and cached diagram snapshots.',
  },
  {
    name: 'Edge router',
    description:
      'Cloudflare Worker that stitches marketing, live, telemetry, help, and api under one hostname via service bindings.',
  },
  {
    name: 'MCP server',
    description:
      'The AI-tools endpoint at https://mcp.livediagram.app. A Cloudflare Worker wrapping the api via a service binding.',
  },
];

export default function StatusPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Status" path="/status" />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Service status
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          The pieces livediagram runs on, and how they&rsquo;re doing.
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">All systems operational</p>
            <p className="text-xs text-emerald-800/80">
              No incidents reported. If you can read this page, the marketing site is up.
            </p>
          </div>
        </div>

        <ul className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {COMPONENTS.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{c.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operational
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-slate-500">
          This page reflects the latest deployed state. Spotted something wrong? Email{' '}
          <a href="mailto:hello@livediagram.app" className="underline hover:text-slate-800">
            hello@livediagram.app
          </a>{' '}
          or file an issue on{' '}
          <a
            href="https://github.com/livediagram-app/monorepo/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-800"
          >
            GitHub
          </a>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
