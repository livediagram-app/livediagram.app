import {
  FeatureCategoryIndex,
  featureCategoryMetadata,
} from '@liveworkspace/help-site/components/FeatureCategoryIndex';
import { site } from '@/lib/help-site';

export const metadata = featureCategoryMetadata(site, 'user-interface');

export default function UserInterfaceCategoryPage() {
  return <FeatureCategoryIndex site={site} slug="user-interface" />;
}
