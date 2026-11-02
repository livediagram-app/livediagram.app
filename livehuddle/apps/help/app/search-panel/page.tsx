import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'search-panel');

export default function SearchPanelCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="search-panel" />;
}
