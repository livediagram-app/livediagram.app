// Real 3D's contact sheet (docs/specs/008-canvas/3d-engine.md "Rollout"): every piece kind built as the scene builds
// it, from four camera turns and at each facing, with a character sat in each of its seats, to check by eye and by
// screenshot that every model reads right from every side. Development only.
import { notFound } from 'next/navigation';
import { Real3DSheet } from './Real3DSheet';

export default function Real3DSheetPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Real3DSheet />;
}
