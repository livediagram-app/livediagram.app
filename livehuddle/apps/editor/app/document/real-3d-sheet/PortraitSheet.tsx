'use client';

import { useEffect, useState } from 'react';
import { AVATAR_CLOTHING, AVATAR_HAIR, DEFAULT_AVATAR_CONFIG } from '@livehuddle/avatar/config';
import { AVATAR_REACTIONS } from '@livehuddle/avatar/reactions';
import { FigurePortrait } from '@/components/palette/FigurePortrait';
import { gameHairStyles } from '@/lib/real-3d/game-look';
import { portraitCount } from '@/lib/real-3d/figure-portrait';

// The palette portraits' contact sheet (docs/specs/008-canvas/3d-engine.md "Palette portraits"), `?portraits=1`:
// every Clothes, Hair and Actions picture the avatar palette shows, for both packs, from the same shared renderer, with
// its render timings once all are drawn. Development only; needs no Space (and so no API).

const SHIRT = '#0ea5e9';

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, margin: '8px 0' }}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, textAlign: 'center', width: 72 }}>
      {children}
      <figcaption style={{ fontSize: 10 }}>{label}</figcaption>
    </figure>
  );
}

export function PortraitSheet() {
  const [stats, setStats] = useState<string | null>(null);
  useEffect(() => {
    // Reports once every picture is drawn: each render's time and each frame's.
    const t = setInterval(() => {
      if (document.querySelector('[data-portrait-loading]')) return;
      clearInterval(t);
      const ms = (name: string) =>
        performance
          .getEntriesByName(name)
          .map((e) => e.duration)
          .sort((a, b) => a - b);
      const r = ms('livehuddle:portrait');
      const f = ms('livehuddle:portrait-frame');
      const at = (a: number[], q: number) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
      setStats(
        JSON.stringify({
          renders: r.length,
          median: at(r, 0.5)?.toFixed(2),
          p95: at(r, 0.95)?.toFixed(2),
          max: r.at(-1)?.toFixed(2),
          frames: f.length,
          frameMedian: at(f, 0.5)?.toFixed(2),
          frameMax: f.at(-1)?.toFixed(2),
          stored: portraitCount(),
        }),
      );
    }, 250);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      style={{ background: '#0b1020', color: '#fff', font: '12px sans-serif', padding: 8 }}
      data-ready={stats ? '' : undefined}
    >
      {(['male', 'female'] as const).map((gender) => {
        const base = { ...DEFAULT_AVATAR_CONFIG, gender, shirt: SHIRT };
        const styles = gameHairStyles(gender === 'female' ? 'women' : 'men');
        return (
          <div key={gender}>
            <Row title={`${gender}: Clothes`}>
              {AVATAR_CLOTHING.map((c) => (
                <Cell key={c.id} label={c.label}>
                  <FigurePortrait
                    look={{ ...base, clothing: c.id }}
                    crop="full"
                    width={56}
                    height={76}
                    fallback={null}
                  />
                </Cell>
              ))}
            </Row>
            <Row title={`${gender}: Hair`}>
              {AVATAR_HAIR.filter((h) => styles.includes(h.id)).map((h) => (
                <Cell key={h.id} label={h.label}>
                  <FigurePortrait
                    look={{ ...base, hair: h.id }}
                    crop="head"
                    width={56}
                    height={52}
                    fallback={null}
                  />
                </Cell>
              ))}
            </Row>
            <Row title={`${gender}: Actions`}>
              {AVATAR_REACTIONS.map((r) => (
                <Cell key={r.id} label={r.label}>
                  <FigurePortrait
                    look={base}
                    crop="action"
                    move={r.id}
                    width={56}
                    height={56}
                    fallback={null}
                  />
                </Cell>
              ))}
            </Row>
          </div>
        );
      })}
      <pre data-stats="">{stats ?? 'drawing...'}</pre>
    </div>
  );
}
