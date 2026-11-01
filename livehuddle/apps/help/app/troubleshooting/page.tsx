import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Troubleshooting',
  description:
    'Solutions to common problems with the livehuddle editor and real-time collaboration.',
  lede: 'Something not working? Start here.',
};

export const metadata = supportCategoryMetadata(site, 'troubleshooting', COPY);

export default function TroubleshootingPage() {
  return <SupportCategoryPage site={site} slug="troubleshooting" copy={COPY} />;
}
