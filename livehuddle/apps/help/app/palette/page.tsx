import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'palette');

export default function PaletteCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="palette" />;
}
