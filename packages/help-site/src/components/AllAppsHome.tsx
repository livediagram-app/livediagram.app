import { APP_ORDER, helpUrl, type AppId } from '@liveworkspace/help-registry';
import { APP_SITES } from '@liveworkspace/sites';
import { appBandStyle, BAND_CLASS, BAND_INK_CLASS } from '../lib/app-palette';
import type { HelpHomeLayout } from '../lib/home';
import type { HelpSite } from '../site';
import { AppMark } from './AppMarks';
import { guideCount } from './CategoryCard';
import { ArrowRightIcon } from './chrome-icons';
import { HelpHome } from './HelpHome';
import { SiteLink } from './SiteLink';

// The All Apps home at www.liveworkspace.app/help (liveworkspace/docs/specs/016-help/help-centre.md "The home
// pages"): "Help for every app" with the guide count across apps, search and Popular chips; Pick an App, five tiles
// each with its mark on a band in its palette, its line and its guide count, linking to its help; then the edition's
// layout (New to liveworkspace?, Written once for every app, the shared categories) and Still Stuck, drawn by the
// same HelpHome every app's help uses.

function pitchOf(app: AppId): string {
  return APP_SITES.find((s) => s.name === app)?.pitch ?? '';
}

/** Pick an App: the five apps' helps, each on its address in the page's deployment (SiteLink). */
export function PickAnApp({ counts }: { counts: Partial<Record<AppId, number>> }) {
  return (
    <section aria-labelledby="pick-an-app" className="mx-auto max-w-7xl px-4 pt-14 md:px-8">
      <div className="mb-6 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
          Pick an App
        </p>
        <h2
          id="pick-an-app"
          className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-slate-50"
        >
          Help for the app you are using
        </h2>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {APP_ORDER.map((app) => (
          <li key={app}>
            <SiteLink
              href={`${helpUrl(app)}/`}
              data-pick-app={app}
              className="card-glow group flex h-full flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900"
            >
              <div
                aria-hidden
                className={`flex h-24 items-center justify-center ${BAND_CLASS} ${BAND_INK_CLASS}`}
                style={appBandStyle(app)}
              >
                <AppMark app={app} size={40} />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{app}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {pitchOf(app)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
                  {counts[app] ? `Browse ${guideCount(counts[app])}` : 'Open'}
                  <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </SiteLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AllAppsHome({
  site,
  home,
  lede,
}: {
  site: HelpSite;
  home: HelpHomeLayout;
  lede: string;
}) {
  return (
    <HelpHome
      site={site}
      home={home}
      lede={lede}
      title="Help for every app"
      note="One help centre for all five apps"
      afterHero={<PickAnApp counts={site.facts.guideCounts ?? {}} />}
    />
  );
}
