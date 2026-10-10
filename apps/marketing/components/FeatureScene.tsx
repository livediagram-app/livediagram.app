'use client';

import { useEffect, useRef, useState } from 'react';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livediagram/ui';
import { EditorWindow } from './hero-editor-window';
import { heroScene, type HeroSceneKey } from './hero-scenes';

// One hero scene in its editor window, for a landing beat or a feature category page's hero
// (docs/specs/019-marketing/marketing-site.md "Feature scenes"). The window's frame and its
// aspect-ratio canvas are in the static HTML, so nothing shifts; the scene itself is first drawn
// the moment it starts to play, building up from an empty canvas, and replays on the hero's cycle
// while it stays on screen. Drawing it settled ahead of time made it flash on arrival: the finished
// picture, then the veil, then the build. It plays once per visit: scrolled away, it rests on its
// settled frame from then on (playing again would snap that frame back to an empty canvas, the
// same flash); under reduced motion it shows only that frame. Only the scene in view animates, and the
// scenes' SVG stays out of the page's HTML (about 18 KB gzipped on the home page).

// The hero's build cycle (HeroIllustration.tsx CYCLE_MS): the scene's keyframes and its closing
// veil (hero-fade) are timed to it, so a replay lands as the veil covers the window.
const CYCLE_MS = 22000;

// The canvas keeps a landscape proportion whatever width its column gives it: wide enough for the
// scene's 600 by 400 viewBox under the toolbar strip, short enough that the window stands no
// taller than the text beside it.
const CANVAS_ASPECT = 'aspect-[16/10]';

// How much of the window must be on screen before it plays: enough that the build is seen from
// its first beat, not so much that a short viewport never starts it.
const IN_VIEW_THRESHOLD = 0.4;

// The veil while a scene rests: none, so arriving at or leaving a settled frame never flashes.
const VEIL_NONE = 'opacity-0';
// The first play starts clear (there is nothing to lift from) and closes at the end; a replay
// lifts from that closed veil as the hero's windows do.
const VEIL_FIRST = 'hero-fade-end';
const VEIL_REPLAY = 'hero-fade';

export function FeatureScene({ scene: key }: { scene: HeroSceneKey }) {
  const scene = heroScene(key);
  const ref = useRef<HTMLDivElement>(null);
  const wasVisible = useRef(false);
  const [inView, setInView] = useState(false);
  const [cycle, setCycle] = useState(0);
  // Set once it has been in view and left: it rests settled from then on.
  const [done, setDone] = useState(false);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const playing = inView && !done && !reduceMotion;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = !!entry?.isIntersecting;
        if (wasVisible.current && !visible) setDone(true);
        wasVisible.current = visible;
        setInView(visible);
      },
      { threshold: IN_VIEW_THRESHOLD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Replay while it stays in view; the timer stops the moment it leaves.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  // Drawn while playing, and settled once it has played or when motion is reduced.
  const drawn = playing || done || reduceMotion;
  const veil = playing ? (cycle === 0 ? VEIL_FIRST : VEIL_REPLAY) : VEIL_NONE;
  const { Board } = scene;
  return (
    <div ref={ref} aria-hidden>
      <EditorWindow
        key={cycle}
        title={scene.title}
        tabs={scene.tabs}
        shared={scene.shared}
        mode={scene.mode}
        playing={playing}
        veil={veil}
        document={drawn ? <Board /> : null}
        canvasClassName={CANVAS_ASPECT}
      />
    </div>
  );
}
