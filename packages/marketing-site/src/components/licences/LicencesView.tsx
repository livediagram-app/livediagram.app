import type { LicencesManifest, LicencesSection, WorkEntry } from '@liveworkspace/licences';
import type { ReactNode } from 'react';

import { LicenceTexts } from './LicenceTexts';

// The /licences page body (docs/specs/002-project-scope/third-party-licences.md
// "The page"): server-rendered sections of collapsed entries; only the texts
// are client-side, and they load when an entry opens. The product hands over
// its title, its lede and what sends code to the browser.

const sectionCopy = (
  browserIntro: string,
): Record<LicencesSection['side'], { title: string; intro: string }> => ({
  browser: { title: 'In your browser', intro: browserIntro },
  server: {
    title: 'On our servers',
    intro:
      'Bundled into the API, MCP server and router, which run on Cloudflare rather than on your device.',
  },
});

export function LicencesView({
  manifest,
  title,
  lede,
  browserIntro,
}: {
  manifest: LicencesManifest;
  title: string;
  lede: ReactNode;
  /** Who sends code to the browser ("the editor, this website and the help centre"). */
  browserIntro: string;
}) {
  const copy = sectionCopy(browserIntro);
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
        {title}
      </h1>
      <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{lede}</p>
      {manifest.sections.map((section) => (
        <Section
          key={section.side}
          section={section}
          manifest={manifest}
          copy={copy[section.side]}
        />
      ))}
    </>
  );
}

function Section({
  section,
  manifest,
  copy,
}: {
  section: LicencesSection;
  manifest: LicencesManifest;
  copy: { title: string; intro: string };
}) {
  const labels = new Map(section.apps.map((app) => [app.id, app.label]));
  const count = section.works.length;
  return (
    <section aria-labelledby={`${section.side}-heading`} className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id={`${section.side}-heading`}
          className="text-xl font-semibold text-slate-900 dark:text-slate-100"
        >
          {copy.title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {count} {count === 1 ? 'work' : 'works'}
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{copy.intro}</p>
      {count === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Nothing third-party ships here.
        </p>
      ) : (
        <ul className="lic-list">
          {section.works.map((work) => (
            <li key={work.anchor}>
              <Entry work={work} labels={labels} manifest={manifest} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Entry({
  work,
  labels,
  manifest,
}: {
  work: WorkEntry;
  labels: Map<string, string>;
  manifest: LicencesManifest;
}) {
  return (
    <details id={work.anchor} className="lic-entry">
      <summary className="lic-summary">
        <h3 className="lic-name">{work.name}</h3>
        <span className="lic-meta">{work.version}</span>
        <span className="lic-tags">
          <code className="lic-id">{work.licence}</code>
          <span className="sr-only">{'Ships in '}</span>
          {work.apps.map((app, i) => (
            <span key={app} className="lic-chip">
              {labels.get(app) ?? app}
              {i < work.apps.length - 1 ? <span className="sr-only">,</span> : null}
            </span>
          ))}
        </span>
      </summary>
      <div className="lic-body">
        {work.carrier ? <p>Inside {work.carrier}.</p> : null}
        {work.homepage ? (
          <p>
            <a
              href={work.homepage}
              aria-label={`Source of ${work.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="lic-link"
            >
              Source
            </a>
          </p>
        ) : null}
        <LicenceTexts
          work={work.name}
          texts={work.texts.map((t) => ({ ...t, lines: manifest.texts[t.hash]?.lines ?? 1 }))}
        />
      </div>
    </details>
  );
}
