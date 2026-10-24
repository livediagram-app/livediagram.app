import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { loadLicencesManifest } from '@liveworkspace/marketing-site/lib/licences-manifest';
import { LicencesView } from '@liveworkspace/marketing-site/components/licences/LicencesView';
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
        <LicencesView
          manifest={manifest}
          title="Third-party licences"
          lede="liveplanner is built on the work of many third-party software projects, each under its own licence. These are the ones our apps ship, generated from what each app actually bundles every time the site is built."
          browserIntro="Sent to your browser by the editor, this website and the help centre."
        />
      </main>
      <Footer />
    </>
  );
}
