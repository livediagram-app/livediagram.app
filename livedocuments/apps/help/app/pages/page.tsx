import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('pages');

export default function PagesCategoryPage() {
  return <FeatureCategoryIndex slug="pages" />;
}
