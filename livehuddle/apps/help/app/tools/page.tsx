import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'tools');

export default function ToolsCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="tools" />;
}
