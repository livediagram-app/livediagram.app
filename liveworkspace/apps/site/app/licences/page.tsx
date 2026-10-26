import { loadLicencesManifest } from '@liveworkspace/marketing-site/lib/licences-manifest';
import { LicencesView } from '@liveworkspace/marketing-site/components/licences/LicencesView';
import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { listedApps } from '@/lib/apps';
import { serverServices } from '@/lib/licences/apps';

export const metadata: Metadata = {
  title: 'Third-party licences · liveworkspace',
  description:
    'The open-source projects liveworkspace.app and its services ship, with their licences and notices, generated from what each one actually bundles.',
  alternates: { canonical: '/licences' },
  openGraph: {
    title: 'Third-party licences · liveworkspace',
    description:
      'The open-source projects liveworkspace.app and its services ship, with their licences and notices.',
    url: '/licences',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Third-party licences · liveworkspace',
    description:
      'The open-source projects liveworkspace.app and its services ship, with their licences and notices.',
  },
};

const apps = listedApps();

// Third-party licences (liveworkspace/docs/site.md "Licences"): every product's page body, from
// @liveworkspace/marketing-site, for the platform's own website and services.
export default function LicencesPage() {
  const manifest = loadLicencesManifest();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <LicencesView
          manifest={manifest}
          title="Third-party licences"
          lede={
            <>
              liveworkspace.app is built on the work of many open-source projects. These are the
              ones this website and the platform&rsquo;s services ship, generated from what each one
              actually bundles every time the site is built. Each app lists its own:{' '}
              {apps.map((app, i) => (
                <span key={app.id}>
                  <a href={`${app.url}/licences`} className="lic-link">
                    {app.name}
                  </a>
                  {i < apps.length - 2 ? ', ' : i === apps.length - 2 ? ' and ' : '.'}
                </span>
              ))}
            </>
          }
          browserIntro="Sent to your browser by this website."
          serverIntro={`Bundled into the platform’s services (${serverServices()}), which run on Cloudflare rather than on your device.`}
        />
      </main>
      <Footer />
    </>
  );
}
