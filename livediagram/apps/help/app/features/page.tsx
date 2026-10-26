import { FeaturesPage, featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

export const metadata = featuresMetadata(
  site,
  'Browse livediagram feature guides by area: User Interface, Explorer, Selection Modes, Palette, Canvas, Tabs, Collaboration, Tools, and Search Panel.',
);

export default function Features() {
  return <FeaturesPage site={site} />;
}
