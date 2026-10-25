'use client';

import { ShareRail as SharedRail } from '@liveworkspace/ui';
import { SiteAppearanceToggle } from './appearance/SiteAppearanceToggle';
import { SITE_PITCH, SITE_URL as SHARE_URL } from './site';

/** The line we want people to pass along; the URL is the shared site origin (./site). */
const SHARE_TEXT = `livediagram: ${SITE_PITCH}. No sign-up needed.`;

// The page-edge rail (docs/specs/019-marketing/marketing-site.md): @liveworkspace/ui's ShareRail, sharing
// this site with its pitch, over this product's Appearance toggle.
export function ShareRail(props: { share?: boolean; wide?: boolean }) {
  return (
    <SharedRail
      url={SHARE_URL}
      text={SHARE_TEXT}
      emailSubject="You should try livediagram"
      appearance={<SiteAppearanceToggle look="rail" />}
      {...props}
    />
  );
}
