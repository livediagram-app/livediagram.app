'use client';

// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): for a person with nothing yet, three
// sections in place of Jump Back In and What Happened. Start Blank (each mode's blank), Popular Templates (the shared
// Popular list's first eight), and Already Have Work? (the way back for someone signed out, and the Explorer's own
// imports). Each start makes its document at once through /new. Loaded only for a first run (HomePane), so the
// template previews never weigh on anyone else's Home.

import { useEffect } from 'react';
import Link from 'next/link';
import { BrandMark } from '@liveplanner/ui';
import type { TemplateKind } from '@liveplanner/templates';
import { track } from '@/lib/telemetry';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { TemplatePicture, templateOf } from '@/components/start/template-card';
import { WELCOME_ALL_TEMPLATES_HREF, WELCOME_COPY } from '@/app/explorer/home/first-run';
import {
  WELCOME_BLANKS,
  WELCOME_POPULAR,
  welcomeStartHref,
} from '@/app/explorer/home/first-run-starts';
import { HomeSection } from './HomeSection';
import { CARD_SURFACE, FOCUS_RING, MUTED } from './home-styles';
import { assignAppLocation } from '@/lib/app-location';

export function HomeWelcome({
  offerSignIn,
}: {
  /** A guest on a deployment with sign-in: they may have been signed out. */
  offerSignIn: boolean;
}) {
  useEffect(() => {
    track('Home', 'Opened', 'Welcome');
  }, []);
  return (
    <div className="flex flex-col gap-10" data-home-welcome="">
      <HomeSection id="start-blank" title={WELCOME_COPY.blanksTitle} busy={false}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {WELCOME_BLANKS.map((kind) => (
            <li key={kind} className="min-w-0">
              <StartCard kind={kind} size="blank" />
            </li>
          ))}
        </ul>
      </HomeSection>

      <HomeSection
        id="popular-templates"
        title={WELCOME_COPY.popularTitle}
        busy={false}
        link={{
          href: WELCOME_ALL_TEMPLATES_HREF,
          label: WELCOME_COPY.allTemplates,
          onNavigate: () => assignAppLocation(WELCOME_ALL_TEMPLATES_HREF),
          onActivate: () => track('Home', 'Selected', 'Welcome.AllTemplates'),
        }}
      >
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {WELCOME_POPULAR.map((kind) => (
            <li key={kind} className="min-w-0">
              <StartCard kind={kind} size="template" />
            </li>
          ))}
        </ul>
      </HomeSection>

      {offerSignIn ? (
        <HomeSection id="have-work" title={WELCOME_COPY.haveWorkTitle} busy={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignInCard />
          </div>
        </HomeSection>
      ) : null}
    </div>
  );
}

/** One start: a blank (a smaller card, five across) or a template (a large card, four across). */
function StartCard({ kind, size }: { kind: TemplateKind; size: 'blank' | 'template' }) {
  const t = templateOf(kind);
  const blank = size === 'blank';
  return (
    <a
      href={welcomeStartHref(kind)}
      data-welcome-start={kind}
      onClick={() => track('Home', 'Selected', blank ? 'Welcome.Blank' : 'Welcome.Template')}
      className={`flex h-full min-w-0 flex-col gap-2.5 rounded-[18px] p-2 pb-3 ${CARD_SURFACE} ${FOCUS_RING}`}
    >
      <span aria-hidden className={`block w-full ${blank ? 'h-24' : 'h-32'}`}>
        <TemplatePicture kind={kind} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-1">
        <span
          className={`truncate font-semibold text-[#17153a] dark:text-slate-100 ${
            blank ? 'text-sm' : 'text-[15px]'
          }`}
        >
          {t.title}
        </span>
        <span className={`line-clamp-2 text-xs leading-[18px] ${MUTED}`}>{t.description}</span>
      </span>
    </a>
  );
}

/** The way back for someone who was signed out: a deep navy card, the sidebar nudge's look at full size. */
function SignInCard() {
  const { signInHref } = useAuthHrefs();
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] bg-[#0b1230] p-5 dark:ring-1 dark:ring-sky-400/30">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-[180px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.45),transparent_70%)]"
      />
      <h3 className="relative flex items-center gap-2.5 text-base font-bold text-white">
        <BrandMark className="size-6 shrink-0" />
        {WELCOME_COPY.signInTitle}
      </h3>
      <p className="relative text-sm leading-relaxed text-[#a9b8d0]">{WELCOME_COPY.signInLine}</p>
      <Link
        href={signInHref}
        onClick={() => track('Home', 'Selected', 'Welcome.SignIn')}
        className="relative mt-auto inline-flex h-10 items-center self-start rounded-xl bg-white px-4 text-sm font-semibold text-[#0b1230] transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        {WELCOME_COPY.signIn}
      </Link>
    </div>
  );
}
