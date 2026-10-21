import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('collaboration');

export default function CollaborationCategoryPage() {
  return <FeatureCategoryIndex slug="collaboration" />;
}
