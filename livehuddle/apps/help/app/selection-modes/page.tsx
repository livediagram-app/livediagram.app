import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'selection-modes');

export default function SelectionModesCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="selection-modes" />;
}
