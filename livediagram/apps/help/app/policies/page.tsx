import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Policies',
  description:
    "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
  lede: "How to report a security issue privately. The terms and privacy policy for livediagram.app are liveworkspace's, at liveworkspace.app/terms and liveworkspace.app/privacy.",
};

export const metadata = supportCategoryMetadata(site, 'policies', COPY);

export default function PoliciesPage() {
  return <SupportCategoryPage site={site} slug="policies" copy={COPY} />;
}
