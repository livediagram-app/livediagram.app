import type { Metadata } from 'next';
import { RoadmapPage } from '@/components/roadmap/public/RoadmapPage';

// A public roadmap's page (docs/specs/026-plan/public-roadmap.md "What a visitor sees"). Static export can't list the
// roadmaps people publish, so one placeholder page is built and the editor worker rewrites every
// /roadmap/<plan>/<code> onto it (as /form/<code> is; a catch-all, so dev serves both parts too); the page reads the plan and code from the address. No editor
// code: the page loads its own small bundle. Kept out of search engines like the rest of the editor app.
export const generateStaticParams = async () => [{ slug: ['placeholder'] }];

export const metadata: Metadata = {
  title: 'Roadmap | liveplanner',
  robots: { index: false },
};

export default function Page() {
  return <RoadmapPage />;
}
