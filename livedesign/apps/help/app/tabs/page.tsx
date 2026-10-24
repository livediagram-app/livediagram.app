import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'tabs');

export default function TabsCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="tabs" />;
}
