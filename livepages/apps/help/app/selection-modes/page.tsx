import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('selection-modes');

export default function SelectionModesCategoryPage() {
  return <FeatureCategoryIndex slug="selection-modes" />;
}
