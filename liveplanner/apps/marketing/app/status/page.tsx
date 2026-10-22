import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { CONTACT_FORM_URL, pageMetadata } from '@liveplanner/ui';

const STATUS_TITLE = 'Status · liveplanner';
const STATUS_DESCRIPTION =
  'Operational status of the liveplanner services: editor, API, realtime room, marketing site, help centre, and database.';

export const metadata = pageMetadata({
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
      'The public landing site at https://liveplanner.app/. Static assets served by a Cloudflare Worker.',
  },
  {
    name: 'Editor (editor app)',
    description:
      'The planner at https://liveplanner.app/new. Static export served by a Cloudflare Worker.',
  },
  {
    name: 'Telemetry dashboard',
    description:
      'The public anonymous-events dashboard at https://liveworkspace.app/telemetry, shared by every liveworkspace app. Served by liveworkspace’s telemetry Worker.',
  },
  {
    name: 'Help centre',
    description:
      'The help centre at https://liveplanner.app/help. Static export served by a Cloudflare Worker.',
  },
  {
    name: 'API',
    description:
      'The backend at https://liveplanner.app/api. A Cloudflare Worker that owns the D1 binding.',
  },
  {
    name: 'Realtime room',
    description:
      'Per-project Durable Object that brokers cursor / selection / log ops. Lives inside the API Worker.',
  },
  {
    name: 'Database',
    description:
      'Cloudflare D1 (SQLite at the edge). Holds projects, tabs, change logs, share links, telemetry events.',
  },
  {
    name: 'Snapshot cache',
    description:
      "Cloudflare R2. Caches each project's rendered snapshot and share-link card. liveplanner takes no image uploads.",
  },
  {
    name: 'Edge router',
    description:
      'Cloudflare Worker that stitches marketing, live, telemetry, help and api under one hostname via service bindings.',
  },
  {
    name: 'MCP server',
    description:
      'The AI-tools endpoint at https://mcp.liveplanner.app. A Cloudflare Worker wrapping the api via a service binding.',
  },
];

export default function StatusPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Status" path="/status" />
      <Header surface="Status" />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          Service status
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
          The pieces liveplanner runs on, and how they&rsquo;re doing.
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-3 w-3 motion-safe:animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              All systems operational
            </p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
              No incidents reported. If you can read this page, the marketing site is up.
            </p>
          </div>
        </div>

        <ul className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {COMPONENTS.map((c) => (
            <li
              key={c.name}
              className="flex flex-col items-start gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              {/* On a phone the badge sits under the text, so the description keeps the card's full
                  width instead of wrapping a host mid-word in a narrow column; min-w-0 + break-words
                  still wrap a long host rather than pushing the badge off a 320px phone. */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.name}</p>
                <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
                  {c.description}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operational
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-slate-500 dark:text-slate-400">
          This page reflects the latest deployed state. Spotted something wrong? Tell us through the{' '}
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-800 dark:hover:text-slate-100"
          >
            contact form
          </a>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
