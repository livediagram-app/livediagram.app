'use client';

import dynamic from 'next/dynamic';

// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor; its chunk stays out of the first load.
const ElementTourHost = dynamic(
  () => import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
  { ssr: false },
);
// The Pages tour (docs/specs/007-editor/pages-tour.md): offered the first time the person works on each kind of
// page; its chunk stays out of the first load too.
const PagesTourHost = dynamic(
  () => import('@/components/tour/PagesTourHost').then((m) => m.PagesTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/pages-tour.md), mounted with the editor so leaving mid-tour still
// runs their clean-up.
export function EditorTours() {
  return (
    <>
      <PagesTourHost />
      <ElementTourHost />
    </>
  );
}
