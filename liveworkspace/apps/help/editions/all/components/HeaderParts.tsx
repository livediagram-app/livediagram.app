'use client';

import type { ReactNode } from 'react';
import { WorkspaceWordmark } from '@liveworkspace/brand';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import {
  buttonClassName,
  ButtonContent,
  ExplorerLink as SharedExplorerLink,
  ShareRail as SharedRail,
  SiteAppearanceToggle,
} from '@liveworkspace/ui';
import { ALL_APPS_APPEARANCE_STORE } from '../lib/appearance-store';

// The All Apps header's pieces, bound for @liveworkspace/ui's createSiteHeader (components/Header.tsx) the way each
// app's ui package binds its own: liveworkspace's wordmark, the Explorer link, Open liveworkspace as the primary,
// and the page-edge rail with the Appearance toggle on liveworkspace.app's store. Every link is a same-origin path:
// the All Apps help is served on liveworkspace.app's own address (live, staging or a dev server), so each stays in
// the page's deployment.

const SHARE_TEXT =
  'liveworkspace help: guides for livediagram, liveplanner, livedocuments, livedesign and livehuddle, in one place.';

/** The logo. Below 360px (a 320px phone) the mark alone, as every app's bar does, its name kept in the label. */
export function Brand({
  href,
  className = '',
}: {
  href: string;
  size: 'md';
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <a href={href} aria-label="liveworkspace" className={`flex shrink-0 items-center ${className}`}>
      <WorkspaceWordmark className="max-[359px]:[&_[data-logotype]]:hidden" />
    </a>
  );
}

export function ExplorerLink(props: { always?: boolean; solid?: boolean }) {
  return <SharedExplorerLink href="/explorer" signedIn={false} {...props} />;
}

/** The bar's primary: back to liveworkspace.app's home, where every app opens. */
export function HeaderPrimaryCta(_props: { ctaSurface?: string; explorerWhenSignedIn?: boolean; quiet?: boolean }) {
  return (
    <a href="/" className={`${buttonClassName({ size: 'cta-sm' })} shrink-0 max-sm:hidden`}>
      <ButtonContent>Open liveworkspace</ButtonContent>
    </a>
  );
}

/** No Start Blank under All Apps: a blank start belongs to one app. */
export function StartBlankLink(_props: { ctaSurface?: string; className?: string }): ReactNode {
  return null;
}

/** No account menu here: the help's bar never carries one (SiteHeader `account`). */
export function SiteAccount(): ReactNode {
  return null;
}

export function ShareRail(props: { share?: boolean; wide?: boolean }) {
  return (
    <SharedRail
      url={`${PLATFORM_SITE.url}/help/`}
      text={SHARE_TEXT}
      emailSubject="liveworkspace help"
      appearance={<SiteAppearanceToggle store={ALL_APPS_APPEARANCE_STORE} look="rail" />}
      {...props}
    />
  );
}
