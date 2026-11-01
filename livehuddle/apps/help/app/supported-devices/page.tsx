import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Supported Devices',
  description:
    'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
  lede: 'livediagram runs in the browser on any device. Pick yours to see what works and what to expect.',
};

export const metadata = supportCategoryMetadata(site, 'supported-devices', COPY);

export default function SupportedDevicesPage() {
  return <SupportCategoryPage site={site} slug="supported-devices" copy={COPY} />;
}
