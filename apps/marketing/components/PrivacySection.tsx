// Privacy section — mirrors the dark visual treatment of the
// UseCaseCarousel above so the landing page reads as two distinct
// promises (what you can make, how we handle the data) separated by
// a darker band. Static, no client-side state.

const PROMISES: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: 'No third-party analytics',
    description:
      'No Google Analytics. No Segment. No marketing pixels. The only product telemetry is anonymous, first-party events served from our own API, with every event we measure listed publicly on /telemetry.',
    icon: <NoTrackerGlyph />,
  },
  {
    title: 'Your data is yours',
    description:
      "Every diagram lives in your own row, scoped to your owner id. Export the whole thing to JSON or PNG whenever you like, and delete your account from settings to remove it all in one go. We don't make money by holding it hostage.",
    icon: <YoursGlyph />,
  },
  {
    title: 'Never sold, never traded',
    description:
      "We don't sell your data. We don't trade it. We don't share it with advertisers or model trainers or anyone else. There is no paid tier and no plan to add one, so we have no commercial pressure to monetise what you draw.",
    icon: <NoSaleGlyph />,
  },
  {
    title: 'Encrypted at rest and in transit',
    description:
      'All persistence runs on Cloudflare D1 + R2, which encrypt every row and blob at rest with AES-256. Every request is TLS, end to end. The same protections protect telemetry, share links, and uploaded images.',
    icon: <LockGlyph />,
  },
  {
    title: 'Private by default',
    description:
      "A new diagram is visible only to you until you generate a share link. Share links are unguessable codes you choose to hand out, you can revoke them at any time, and revoking instantly disconnects anyone who's currently using it.",
    icon: <ShieldGlyph />,
  },
  {
    title: 'Open source, auditable',
    description:
      'The whole stack (editor, API, this site) is on GitHub under the MIT license. Anything we claim here, you can read in the source. Run your own copy if you prefer, on your own Cloudflare account, in an afternoon.',
    icon: <OpenGlyph />,
  },
];

export function PrivacySection() {
  return (
    <section
      id="privacy"
      className="border-t border-slate-800 bg-slate-900"
      aria-labelledby="privacy-heading"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">
            Privacy by design
          </p>
          <h2
            id="privacy-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            Your data, your call
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            We don&rsquo;t make money by being creepy. No third-party trackers, no ads, no resale,
            no surprise audience. Just a diagram editor that treats your work like your work.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROMISES.map((p) => (
            <article
              key={p.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/40 p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                {p.icon}
              </span>
              <h3 className="text-base font-semibold text-white">{p.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{p.description}</p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-500">
          Read the full{' '}
          <a href="/privacy" className="underline transition hover:text-slate-300">
            privacy policy
          </a>
          {' or check the live '}
          <a href="/telemetry" className="underline transition hover:text-slate-300">
            telemetry dashboard
          </a>
          .
        </p>
      </div>
    </section>
  );
}

// 18x18 inline glyphs. Single-stroke line art so they read on the
// dark band without competing with the heading.
function strokeProps() {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
}
function NoTrackerGlyph() {
  return (
    <svg {...strokeProps()}>
      <circle cx="9" cy="9" r="6" />
      <path d="M4.5 4.5 L13.5 13.5" />
    </svg>
  );
}
function YoursGlyph() {
  return (
    <svg {...strokeProps()}>
      <rect x="3" y="3" width="12" height="12" rx="1.5" />
      <path d="M6 9 L8.5 11.5 L12.5 6.5" />
    </svg>
  );
}
function NoSaleGlyph() {
  return (
    <svg {...strokeProps()}>
      <path d="M3 3 L8 3 L15 10 L10 15 L3 8 Z" />
      <circle cx="6" cy="6" r="0.8" fill="currentColor" />
      <path d="M3.5 13.5 L13.5 3.5" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg {...strokeProps()}>
      <rect x="4" y="8" width="10" height="7" rx="1" />
      <path d="M6 8 V5.5 A3 3 0 0 1 12 5.5 V8" />
    </svg>
  );
}
function ShieldGlyph() {
  return (
    <svg {...strokeProps()}>
      <path d="M9 2 L14.5 4.5 V9 C14.5 12.5 11.5 15 9 16 C 6.5 15 3.5 12.5 3.5 9 V4.5 Z" />
      <path d="M6.5 9 L8.5 11 L11.5 7.5" />
    </svg>
  );
}
function OpenGlyph() {
  return (
    <svg {...strokeProps()}>
      <path d="M6.5 12.5 C5 11 5 7 6.5 5.5 C8 4 11 4 13 6" />
      <path d="M11.5 5.5 L13 6 L12.5 7.5" />
      <path d="M11.5 5.5 L7 13" />
    </svg>
  );
}
