import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'About liveplanner',
  description: 'What liveplanner is, who it is for, and why it exists.',
  lede: 'What liveplanner is, who it is for, and why it exists.',
};

export const metadata = supportCategoryMetadata(site, 'about', COPY);

export default function AboutPage() {
  return <SupportCategoryPage site={site} slug="about" copy={COPY} />;
}
