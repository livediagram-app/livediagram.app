import {
  SupportCategoryPage,
  supportCategoryMetadata,
} from '@liveworkspace/help-site/components/CategoryPages';
import { site } from '@/lib/help-site';

const COPY = {
  title: 'Developers',
  description:
    'Call the livehuddle REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
  lede: 'Drive livehuddle from your own scripts and integrations. The same REST API the editor uses, callable with an API token.',
};

export const metadata = supportCategoryMetadata(site, 'developers', COPY);

export default function DevelopersPage() {
  return <SupportCategoryPage site={site} slug="developers" copy={COPY} />;
}
