import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('tools');

export default function ToolsCategoryPage() {
  return <FeatureCategoryIndex slug="tools" />;
}
