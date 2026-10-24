import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Supported Devices',
  description:
    'How liveplanner works on a computer, a tablet, and a phone, and what to expect on each.',
  lede: 'liveplanner runs in the browser on any device. Pick yours to see what works and what to expect.',
};

export const metadata = supportCategoryMetadata(site, 'supported-devices', COPY);

export default function SupportedDevicesPage() {
  return <SupportCategoryPage site={site} slug="supported-devices" copy={COPY} />;
}
