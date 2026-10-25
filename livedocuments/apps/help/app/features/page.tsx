import { FeaturesPage, featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

export const metadata = featuresMetadata(
  site,
  'Browse livedocuments feature guides by area: User Interface, Explorer, Palette, Canvas, Tabs, Collaboration, and Tools.',
);

export default function Features() {
  return <FeaturesPage site={site} />;
}
