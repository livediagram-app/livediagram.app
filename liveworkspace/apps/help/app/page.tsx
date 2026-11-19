import { AllAppsHome } from '@liveworkspace/help-site/components/AllAppsHome';
import { HelpHome, helpHomeMetadata } from '@liveworkspace/help-site/components/HelpHome';
import { EDITION } from '@/editions';
import { site } from '@/lib/help-site';

// The help home (liveworkspace/docs/specs/016-help/help-centre.md "The home pages"): an app's keeps the layout its
// help has always had, from its edition; All Apps' adds Pick an App and its own sections.
export const metadata = helpHomeMetadata(site);

export default function Home() {
  if (EDITION.app === 'all')
    return <AllAppsHome site={site} home={EDITION.homeLayout} lede={EDITION.heroLede} />;
  return (
    <HelpHome
      site={site}
      home={EDITION.homeLayout}
      lede={EDITION.heroLede}
      issuesUrl={EDITION.issuesUrl}
    />
  );
}
