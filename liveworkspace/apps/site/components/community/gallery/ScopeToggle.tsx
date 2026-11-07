'use client';

import { BrandMark } from '@livediagram/ui';
import { AppScopeToggle } from '@liveworkspace/ui';
import { PLATFORM_SITE, siteOfApp } from '@liveworkspace/sites';
import { COMMUNITY_APP_WORDS } from '@liveworkspace/community-ui/words';
import { useCommunitySite } from '../client';
import { appNameOf } from '../lib/links';

// Which posts the gallery shows (liveworkspace/docs/specs/010-site/site.md "The Community", Which posts): the app whose
// address this is, or All Apps, the same switch the Explorer's pane header draws (@liveworkspace/ui AppScopeToggle),
// each side with its logo. On liveworkspace.app there is no app to choose, so nothing is drawn.
export function ScopeToggle({ className = '' }: { className?: string }) {
  const { pageApp, scopeControl } = useCommunitySite();
  if (!pageApp || !scopeControl) return null;
  const site = siteOfApp(appNameOf(pageApp));
  return (
    <AppScopeToggle
      value={scopeControl.value}
      onChange={scopeControl.set}
      className={className}
      app={{
        label: site.name,
        logo: <BrandMark accentColor={site.accent} />,
        description: `Only ${COMMUNITY_APP_WORDS[pageApp].nouns} made with ${site.name}`,
      }}
      all={{
        label: 'All Apps',
        logo: <BrandMark accentColor={PLATFORM_SITE.accent} />,
        description: 'What people made with every liveworkspace app',
      }}
    />
  );
}
