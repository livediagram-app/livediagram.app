import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'pages');

export default function PagesCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="pages" />;
}
