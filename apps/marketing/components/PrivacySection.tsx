// Privacy section: shares the TemplateGallery's inset band (band-classes.ts), so the
// landing page reads as two distinct promises (what you can make, how we handle the data)
// set apart from the story beats. Each card leads with an animated illustration in the
// FeatureArt vocabulary (Frame + SVG + fa-* keyframes), drawn for both appearances.

import {
  BAND_CARD,
  BAND_EYEBROW,
  BAND_LEAD,
  BAND_SECTION,
  BAND_TITLE,
} from '@/components/band-classes';
import {
  DataIsYoursArt,
  EncryptedArt,
  NoSaleArt,
  NoTrackersArt,
  OpenSourceArt,
  PrivateByDefaultArt,
} from './PrivacyArt';

const PROMISES: { title: string; description: string; art: React.ReactNode }[] = [
  {
    title: 'No third-party analytics',
    description:
      'No Google Analytics. No Segment. No marketing pixels. The only product telemetry is anonymous, first-party events served from our own API, with every event we measure listed publicly on /telemetry.',
    art: <NoTrackersArt />,
  },
  {
    title: 'Your data is yours',
    description:
      "Every diagram lives in your own row, scoped to your owner id. Export any tab to PNG, SVG, PDF, Mermaid, Markdown, or portable JSON whenever you like, and delete your account from settings to remove it all in one go. We don't make money by holding it hostage.",
    art: <DataIsYoursArt />,
  },
  {
    title: 'Never sold, never traded',
    description:
      "We don't sell your data. We don't trade it. We don't share it with advertisers or model trainers or anyone else. There is no paid tier and no plan to add one, so we have no commercial pressure to monetise what you draw.",
    art: <NoSaleArt />,
  },
  {
    title: 'Encrypted at rest and in transit',
    description:
      'All persistence runs on Cloudflare D1 + R2, which encrypt every row and blob at rest with AES-256. Every request is TLS, end to end. The same protections protect telemetry, share links, and uploaded images.',
    art: <EncryptedArt />,
  },
  {
    title: 'Private by default',
    description:
      'A new diagram is visible only to you until you generate a share link. Share links are unguessable codes you choose to hand out: protect them with a password, set them to expire automatically after a week, a month, or six months, or revoke them at any time, instantly disconnecting anyone currently using one.',
    art: <PrivateByDefaultArt />,
  },
  {
    title: 'Open source, auditable',
    description:
      'The whole stack (editor, API, this site) is on GitHub under the MIT license. Anything we claim here, you can read in the source. Run your own copy if you prefer, on your own Cloudflare account, in an afternoon.',
    art: <OpenSourceArt />,
  },
];

export function PrivacySection() {
  return (
    <section id="privacy" className={BAND_SECTION} aria-labelledby="privacy-heading">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={BAND_EYEBROW}>Privacy by design</p>
          <h2 id="privacy-heading" className={BAND_TITLE}>
            Your data, your call
          </h2>
          <p className={BAND_LEAD}>
            We don&rsquo;t make money by being creepy. No third-party trackers, no ads, no resale,
            no surprise audience. Just a diagram editor that treats your work like your work.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROMISES.map((p) => (
            <article key={p.title} className={`flex flex-col p-5 ${BAND_CARD}`}>
              {p.art}
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {p.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-600 dark:text-slate-400">
          Read the full{' '}
          <a
            href="/help/policies/privacy-policy/"
            className="underline transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            privacy policy
          </a>
          {' or check the live '}
          <a
            href="/telemetry"
            className="underline transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            telemetry dashboard
          </a>
          .
        </p>
      </div>
    </section>
  );
}
