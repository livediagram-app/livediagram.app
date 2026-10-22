import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('tabs');

export default function TabsCategoryPage() {
  return <FeatureCategoryIndex slug="tabs" />;
}
