import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('palette');

export default function PaletteCategoryPage() {
  return <FeatureCategoryIndex slug="palette" />;
}
