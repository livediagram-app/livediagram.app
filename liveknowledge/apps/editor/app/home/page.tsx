'use client';

import dynamic from 'next/dynamic';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';

// /home: the Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md) at an address the router
// sends to the editor app (`home` is one of its route segments), since `/` itself is the marketing site's.
const HomeScreen = dynamic(() => import('@/components/home/HomeScreen').then((m) => m.HomeScreen), {
  ssr: false,
  loading: () => <OpeningScreen />,
});

export default function HomePage() {
  return <HomeScreen />;
}
