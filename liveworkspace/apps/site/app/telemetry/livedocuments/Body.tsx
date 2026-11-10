'use client';

import { AppDashboard, type AppBodyProps } from '../_shared/AppDashboard';
import { LIVEDOCUMENTS } from './config';

// livedocuments.app's dashboard: the shared one, filled from its config. The page loads each app's on
// demand, so this module is where its own data starts.
export function Body(props: AppBodyProps) {
  return <AppDashboard app={LIVEDOCUMENTS} {...props} />;
}
