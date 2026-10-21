// Wireframe layouts for a watch (docs/specs/007-editor/wireframe-pages.md "Wireframe layouts"):
// Glance, List and Notification, built for a watch face's small safe area.
import type { Element } from '@liveplanner/document';
import type { LayoutBox } from './page-layout-kit';
import { ui, WF } from './wireframe-layout-kit';

export function watchGlance(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  // The ring prints its own share at its middle; the figure and goal sit under it.
  const d = Math.min(W - 24, H - 64);
  u.els.push(
    u.k.shape('progress-ring', (W - d) / 2, 0, d, d, {
      label: '',
      progress: 72,
      strokeColor: WF.ink,
      fillColor: WF.place,
    }),
  );
  u.text(0, d + 8, W, 28, '7,240 steps', { size: 18, bold: true, color: WF.ink, align: 'center' });
  u.text(0, d + 36, W, 18, 'Goal 10,000', { size: 12, color: WF.muted, align: 'center' });
  return u.els;
}

export function watchList(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.text(0, 0, W, 24, 'Today', { size: 17, bold: true, color: WF.ink });
  const rows: [string, string][] = [
    ['activity', 'Workout'],
    ['bell', 'Reminders'],
    ['message', 'Messages'],
    ['calendar', 'Calendar'],
  ];
  let y = 32;
  for (const [iconId, label] of rows) {
    if (y + 40 > H) break;
    u.block(0, y, W, 40, { fillColor: WF.soft, borderRadius: 'lg' });
    u.icon(10, y + 9, 22, iconId, WF.ink);
    u.text(42, y, W - 50, 40, label, { size: 14, bold: true, color: WF.ink });
    y += 46;
  }
  return u.els;
}

export function watchNotification(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.block(0, 0, 32, 32, { fillColor: WF.ink, borderRadius: 'full' });
  u.icon(7, 7, 18, 'message', WF.white);
  u.text(40, 0, W - 40, 32, 'Messages', { size: 13, color: WF.muted });
  u.text(0, 40, W, 22, 'Alex Morgan', { size: 16, bold: true, color: WF.ink });
  u.text(0, 64, W, 40, 'Running 5 minutes late, see you soon!', {
    size: 13,
    color: WF.body,
    alignY: 'top',
  });
  const bh = 36;
  u.button(0, Math.max(110, H - 2 * bh - 6), W, bh, 'Reply');
  u.button(0, Math.max(110 + bh + 6, H - bh), W, bh, 'Dismiss', 'secondary');
  return u.els;
}

export function watchWorkout(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.icon(0, 2, 18, 'flame', WF.ink);
  u.text(24, 0, W - 24, 22, 'Outdoor Run', { size: 13, bold: true, color: WF.muted });
  u.text(0, 26, W, 40, '24:18', { size: 34, bold: true, color: WF.ink });
  const rows: [string, string, string][] = [
    ['heart', '142', 'BPM'],
    ['map-pin', '3.24', 'KM'],
    ['flame', '286', 'KCAL'],
  ];
  rows.forEach(([iconId, n, unit], i) => {
    const y = 74 + i * 28;
    if (y + 24 > H - 40) return;
    u.icon(0, y + 3, 16, iconId, WF.muted);
    u.text(22, y, 70, 24, n, { size: 18, bold: true, color: WF.ink });
    u.text(84, y + 4, W - 84, 20, unit, { size: 12, color: WF.muted });
  });
  u.button(0, H - 36, W, 36, 'End Workout');
  return u.els;
}

export function watchNowPlaying(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  const art = 56;
  u.picture(0, 0, art, art, 'md');
  u.text(art + 10, 4, W - art - 10, 22, 'Morning Light', { size: 14, bold: true, color: WF.ink });
  u.text(art + 10, 26, W - art - 10, 20, 'The Quiet Hours', { size: 12, color: WF.muted });
  const y = art + 18;
  u.block(0, y, W, 4, { fillColor: WF.line, borderRadius: 'full' });
  u.block(0, y, W * 0.4, 4, { fillColor: WF.ink, borderRadius: 'full' });
  const d = Math.min(56, H - y - 24);
  const cy = y + 18;
  u.els.push(
    u.k.shape('circle', (W - d) / 2, cy, d, d, {
      label: '',
      fillColor: WF.ink,
      strokeWidth: 'none',
    }),
  );
  const t = d * 0.36;
  u.els.push(
    u.k.shape('triangle', W / 2 - t / 2 + t * 0.08, cy + d / 2 - t / 2, t, t, {
      label: '',
      rotation: 90,
      fillColor: WF.white,
      strokeColor: WF.white,
      strokeWidth: 'none',
    }),
  );
  for (const dir of [-1, 1] as const) {
    const sx = W / 2 + dir * (d / 2 + 26);
    u.els.push(
      u.k.shape('triangle', sx - 8, cy + d / 2 - 8, 16, 16, {
        label: '',
        rotation: dir * 90,
        fillColor: WF.ink,
        strokeColor: WF.ink,
        strokeWidth: 'none',
      }),
    );
  }
  return u.els;
}

export function watchWeather(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.text(0, 0, W - 40, 22, 'London', { size: 14, bold: true, color: WF.ink });
  u.icon(W - 28, 0, 28, 'cloud', WF.ink);
  u.text(0, 24, W, 56, '18°', { size: 48, bold: true, color: WF.ink });
  u.text(0, 82, W, 20, 'Cloudy · H 21° L 12°', { size: 12, color: WF.muted });
  const hours: [string, string, string][] = [
    ['11', 'cloud', '18°'],
    ['12', 'sun', '20°'],
    ['13', 'sun', '21°'],
    ['14', 'cloud', '19°'],
  ];
  const step = W / hours.length;
  const y = Math.min(112, H - 64);
  hours.forEach(([h, iconId, t], i) => {
    const x = i * step;
    u.text(x, y, step, 18, h, { size: 11, color: WF.muted, align: 'center' });
    u.icon(x + step / 2 - 9, y + 20, 18, iconId, WF.ink);
    u.text(x, y + 42, step, 20, t, { size: 13, bold: true, color: WF.ink, align: 'center' });
  });
  return u.els;
}

export function watchTimer(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  const d = Math.min(W - 24, H - 60);
  u.els.push(
    u.k.shape('progress-ring', (W - d) / 2, 0, d, d, {
      label: '',
      progress: 64,
      strokeColor: WF.ink,
      fillColor: WF.place,
    }),
  );
  u.text(0, d + 6, W, 22, '03:12 left', { size: 16, bold: true, color: WF.ink, align: 'center' });
  const bw = (W - 8) / 2;
  u.button(0, H - 34, bw, 34, 'Pause', 'secondary');
  u.button(bw + 8, H - 34, bw, 34, 'Cancel', 'secondary');
  return u.els;
}

export function watchHeartRate(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.icon(0, 2, 18, 'heart', WF.ink);
  u.text(24, 0, W - 24, 22, 'Heart Rate', { size: 13, bold: true, color: WF.muted });
  u.text(0, 28, W, 48, '72', { size: 44, bold: true, color: WF.ink });
  u.text(64, 50, W - 64, 22, 'BPM', { size: 13, bold: true, color: WF.muted });
  // The last hour as bars, the latest dark.
  const n = 12;
  const bw = W / n - 3;
  const base = H - 24;
  const heights = [0.4, 0.55, 0.5, 0.7, 0.6, 0.45, 0.65, 0.8, 0.55, 0.6, 0.75, 0.68];
  heights.forEach((f, i) => {
    const h = Math.max(6, f * (base - 96));
    u.block(i * (bw + 3), base - h, bw, h, {
      fillColor: i === n - 1 ? WF.ink : WF.line,
      borderRadius: 'full',
    });
  });
  u.text(0, base + 4, W, 18, 'Resting 58 · Today', { size: 11, color: WF.muted });
  return u.els;
}

export function watchUpNext(box: LayoutBox): Element[] {
  const u = ui(box);
  const { W, H } = u;
  u.text(0, 0, W, 22, 'Up Next', { size: 13, bold: true, color: WF.muted });
  const events: [string, string][] = [
    ['Design Review', '10:00 – 11:00'],
    ['Lunch with Sam', '12:30'],
    ['Gym', '18:00'],
  ];
  events.forEach(([title, time], i) => {
    const y = 28 + i * 52;
    if (y + 46 > H) return;
    u.block(0, y, 4, 44, { fillColor: i === 0 ? WF.ink : WF.line, borderRadius: 'full' });
    u.text(12, y, W - 12, 24, title, { size: 15, bold: true, color: WF.ink });
    u.text(12, y + 22, W - 12, 20, time, { size: 12, color: WF.muted });
  });
  return u.els;
}
