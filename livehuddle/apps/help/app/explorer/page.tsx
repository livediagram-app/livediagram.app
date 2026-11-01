import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'explorer');

export default function ExplorerCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="explorer" />;
}
