import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'canvas');

export default function CanvasCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="canvas" />;
}
