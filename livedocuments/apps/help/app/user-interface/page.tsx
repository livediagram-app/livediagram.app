import { FeatureCategoryIndex, featureCategoryMetadata } from '@/components/FeatureCategoryIndex';

export const metadata = featureCategoryMetadata('user-interface');

export default function UserInterfaceCategoryPage() {
  return <FeatureCategoryIndex slug="user-interface" />;
}
