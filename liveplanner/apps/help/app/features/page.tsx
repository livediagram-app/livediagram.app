import { FeaturesPage, featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

export const metadata = featuresMetadata(
  site,
  'Browse liveplanner feature guides by area: Plan, User Interface, Explorer, Tabs, Collaboration, Tools, and Search Panel.',
);

export default function Features() {
  return <FeaturesPage site={site} />;
}
