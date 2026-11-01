import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'collaboration');

export default function CollaborationCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="collaboration" />;
}
