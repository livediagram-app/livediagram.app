import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { LicencesView } from '@/components/licences/LicencesView';
import { loadLicencesManifest } from '@/lib/licences-manifest';
import { pageMetadata, SiteHeader } from '@liveplanner/ui';

export const metadata = pageMetadata({
  title: 'Third-party licences · liveplanner',
  description:
    'The third-party software liveplanner ships, with its licences and notices, generated from what each app actually bundles.',
  path: '/licences',
});

// Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
// Not a landing-funnel surface, so the header's calls to action carry no
// `via` (blueprint D15); otherwise the bar is every marketing page's (marketing-site.md "Header").
export default function LicencesPage() {
  const manifest = loadLicencesManifest();
  return (
    <>
      <BreadcrumbJsonLd name="Licences" path="/licences" />
      <SiteHeader buildWithAi="link" account />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <LicencesView manifest={manifest} />
      </main>
      <Footer />
    </>
  );
}
