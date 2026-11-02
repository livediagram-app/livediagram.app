import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'About livehuddle',
  description: 'What livehuddle is, who it is for, and why it exists.',
  lede: 'What livehuddle is, who it is for, and why it exists.',
};

export const metadata = supportCategoryMetadata(site, 'about', COPY);

export default function AboutPage() {
  return <SupportCategoryPage site={site} slug="about" copy={COPY} />;
}
