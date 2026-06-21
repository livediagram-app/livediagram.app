import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('activity-panel');

export default function ActivityPanelCategoryPage() {
  return <FeatureCategoryIndex slug="activity-panel" />;
}
