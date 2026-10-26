import { FeaturesPage, featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

export const metadata = featuresMetadata(site);

export default function Features() {
  return <FeaturesPage site={site} />;
}
