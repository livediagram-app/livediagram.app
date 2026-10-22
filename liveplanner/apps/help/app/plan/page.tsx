import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('plan');

export default function PlanCategoryPage() {
  return <FeatureCategoryIndex slug="plan" />;
}
