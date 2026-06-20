import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('search-panel');

export default function SearchPanelCategoryPage() {
  return <FeatureCategoryIndex slug="search-panel" />;
}
