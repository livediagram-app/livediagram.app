import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { LicencesView } from '@/components/licences/LicencesView';
import { loadLicencesManifest } from '@/lib/licences-manifest';
import { pageMetadata, SiteHeader } from '@liveplanner/ui';

export const metadata = pageMetadata({
  title: 'Open-source licences · liveplanner',
  description:
    'The open-source projects liveplanner ships, with their licences and notices, generated from what each app actually bundles.',
  path: '/licences',
});

// Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
// Not a landing-funnel surface, so the header's calls to action carry no
// `via` (blueprint D15).
export default function LicencesPage() {
  const manifest = loadLicencesManifest();
  return (
    <>
      <BreadcrumbJsonLd name="Licences" path="/licences" />
      <SiteHeader productNav="home" />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <LicencesView manifest={manifest} />
      </main>
      <Footer />
    </>
  );
}
