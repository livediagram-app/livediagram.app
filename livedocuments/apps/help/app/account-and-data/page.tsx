import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Account and Data',
  description: 'Guest access, signing in, syncing, exporting, and deleting your data.',
  lede: 'How identity works, what an account adds, and how to manage your data.',
};

export const metadata = supportCategoryMetadata(site, 'account-and-data', COPY);

export default function AccountAndDataPage() {
  return <SupportCategoryPage site={site} slug="account-and-data" copy={COPY} />;
}
