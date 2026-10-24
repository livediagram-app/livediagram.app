import { HelpHome, helpHomeMetadata } from '@liveworkspace/help-site/components/HelpHome';
import { REPO_URL } from '@livedesign/ui';
import { HOME } from '@/lib/home-sections';
import { site } from '@/lib/help-site';

export const metadata = helpHomeMetadata(site);

export default function Home() {
  return (
    <HelpHome
      site={site}
      home={HOME}
      lede="Guides and answers for every part of livedesign, from your first design onwards."
      issuesUrl={`${REPO_URL}/issues`}
    />
  );
}
