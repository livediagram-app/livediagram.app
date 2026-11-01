import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Privacy and Security',
  description:
    'How your data is handled, what livehuddle collects, and how share links are protected.',
  lede: 'How your data is handled and how to keep your canvases safe.',
};

export const metadata = supportCategoryMetadata(site, 'privacy-and-security', COPY);

export default function PrivacyAndSecurityPage() {
  return <SupportCategoryPage site={site} slug="privacy-and-security" copy={COPY} />;
}
