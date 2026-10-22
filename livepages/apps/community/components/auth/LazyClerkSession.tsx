'use client';

import dynamic from 'next/dynamic';

// Clerk, fetched only when this mounts (My Shares on); see ClerkSession.
export const LazyClerkSession = dynamic(() => import('./ClerkSession'), { ssr: false });
