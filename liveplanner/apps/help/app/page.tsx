import { HelpHome, helpHomeMetadata } from '@liveworkspace/help-site/components/HelpHome';
import { HOME } from '@/lib/home-sections';
import { site } from '@/lib/help-site';

export const metadata = helpHomeMetadata(site);

export default function Home() {
  return (
    <HelpHome
      site={site}
      home={HOME}
      lede="Guides and answers for every part of liveplanner, from your first plan onwards."
    />
  );
}
