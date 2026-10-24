import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'plan');

export default function PlanCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="plan" />;
}
