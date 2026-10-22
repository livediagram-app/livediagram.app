import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('canvas');

export default function CanvasCategoryPage() {
  return <FeatureCategoryIndex slug="canvas" />;
}
