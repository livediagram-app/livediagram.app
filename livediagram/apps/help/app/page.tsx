import { HelpHome, helpHomeMetadata } from '@liveworkspace/help-site/components/HelpHome';
import { REPO_URL } from '@livediagram/ui';
import { HOME } from '@/lib/home-sections';
import { site } from '@/lib/help-site';

export const metadata = helpHomeMetadata(site);

export default function Home() {
  return (
    <HelpHome
      site={site}
      home={HOME}
      lede="Guides and answers for every part of livediagram, from your first diagram onwards."
      issuesUrl={`${REPO_URL}/issues`}
    />
  );
}
