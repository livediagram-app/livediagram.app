import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('explorer');

export default function ExplorerCategoryPage() {
  return <FeatureCategoryIndex slug="explorer" />;
}
