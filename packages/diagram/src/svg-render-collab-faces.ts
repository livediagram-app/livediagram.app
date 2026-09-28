// Collaborate panels in the headless render (docs/specs/020-import-export/export-fidelity.md "The behaviour
// cards export as they look"): each card's structure and its marks, in its
// real colours and at its real scale, laid out in design units and scaled the
// way CollabScale does on the canvas.

import {
  agendaTotalMinutes,
  DECISION_STATUS_HUES,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
  estimateRank,
  estimateSpread,
  estimateSpreadLabel,
  estimateScalePending,
  estimateValues,
  ESTIMATE_SCALE_LABELS,
  ESTIMATE_SCALE_VALUES,
  ESTIMATE_SCALES,
  TEMPERATURE_COLORS,
  TEMPERATURE_FACE_MOUTHS,
  TEMPERATURE_VALUES,
  temperaturePosition,
  type RollCallEntry,
} from './collab-shapes';
import { initialsOf } from './names';
import { responseStats, responseTally } from './responses';
import { qaView } from './qa-board';
import {
  QUIZ_CORRECT_GREEN,
  QUIZ_DESIGN_SIZE,
  QUIZ_DISC_RADIUS,
  QUIZ_OPTION_HEIGHT,
  QUIZ_OPTION_WIDTH,
  quizCorrectKeys,
  quizOptionCentres,
  quizTally,
} from './quiz';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  BODY_PX,
  checkMark,
  collabCard,
  glow,
  lockMark,
  moodFace,
  personDisc,
  PAD_X,
  PAD_Y,
  pill,
  text,
  TITLE_PX,
  type Face,
} from './svg-render-face-kit';

// ── Collaborate panels (docs/specs/012-collaboration/estimate-card.md to /129, /137) ─────────────────────────

export function svgCollabFace(
  el: Face,
  label: string,
  color: string,
  // The resolved stroke. Only the quiz reads it, and only when the element
  // carries its own (strokeColor), so an unstyled quiz keeps its text-tint rim.
  stroke?: string,
): string | null {
  const title = label.trim();
  switch (el.shape) {
    case 'estimate': {
      // The card as the face draws it (docs/specs/012-collaboration/estimate-card.md "The look"): the scale
      // chooser while the card has no scale; otherwise the scale's cards over
      // the room's cards, face down before the reveal (hidden answers stay
      // hidden in the export too) and face up after, sorted low to high with
      // the spread and its two ends ringed. An estimate stores an opaque key
      // per answer, not a name, so people are neutral discs.
      const scale = el.estimateScale;
      const responses = el.responses ?? [];
      const revealed = el.responsesRevealed === true;
      return collabCard(
        el,
        title || 'Estimate',
        responses.length ? `${responses.length} answered` : undefined,
        color,
        (w, h) => {
          const inner = w - PAD_X * 2;
          const top = PAD_Y + TITLE_PX + 10;
          if (estimateScalePending(el)) {
            const rowH = 42;
            return (
              text(PAD_X, top + 14, 'Choose a scale', { size: 12, weight: 600, color }) +
              ESTIMATE_SCALES.map((sc, i) => {
                const y = top + 26 + i * (rowH + 6);
                return (
                  `<rect x="${r2(PAD_X)}" y="${r2(y)}" width="${r2(inner)}" height="${rowH}" rx="10" fill="${xmlEscape(color)}" fill-opacity="0.04" stroke="${xmlEscape(color)}" stroke-opacity="0.14"/>` +
                  text(PAD_X + 12, y + 18, ESTIMATE_SCALE_LABELS[sc], {
                    size: 11.5,
                    weight: 600,
                    color,
                  }) +
                  text(PAD_X + 12, y + 32, ESTIMATE_SCALE_VALUES[sc].join(' · '), {
                    size: 10,
                    color,
                    opacity: 0.55,
                  })
                );
              }).join('')
            );
          }
          const values = estimateValues(scale);
          const gap = 5;
          const cw = Math.min(46, (inner - gap * (values.length - 1)) / values.length);
          const rowW = cw * values.length + gap * (values.length - 1);
          const x0 = PAD_X + (inner - rowW) / 2;
          const picks = values
            .map((v, i) => {
              const x = x0 + i * (cw + gap);
              return (
                `<rect x="${r2(x)}" y="${r2(top)}" width="${r2(cw)}" height="44" rx="10" fill="${xmlEscape(color)}" fill-opacity="0.05" stroke="${xmlEscape(color)}" stroke-opacity="0.14"/>` +
                text(x + cw / 2, top + 27, v, { size: 13, weight: 700, color, anchor: 'middle' })
              );
            })
            .join('');
          const tableTop = top + 60;
          const mid = (tableTop + h - PAD_Y) / 2;
          if (responses.length === 0) {
            return (
              picks +
              text(w / 2, mid, 'No picks yet', { size: 11, weight: 600, color, anchor: 'middle' })
            );
          }
          const card = (x: number, y: number, face: string | null, ring: boolean): string =>
            `<rect x="${r2(x)}" y="${r2(y)}" width="34" height="46" rx="8" fill="${xmlEscape(color)}" fill-opacity="${face === null ? 0.16 : 0.05}" stroke="${xmlEscape(color)}" stroke-opacity="${ring ? 0.85 : face === null ? 0.35 : 0.18}" stroke-width="${ring ? 2 : 1}"/>` +
            (face === null
              ? ''
              : text(x + 17, y + 28, face, { size: 14, weight: 700, color, anchor: 'middle' })) +
            personDisc(x + 17, y + 48, 7, color);
          const shown = responses.slice(0, 8);
          const handW = shown.length * 34 + (shown.length - 1) * 8;
          const hx = w / 2 - handW / 2;
          if (!revealed) {
            return (
              picks +
              shown.map((_, i) => card(hx + i * 42, tableTop + 8, null, false)).join('') +
              text(w / 2, tableTop + 84, `${responses.length} in, hidden until the reveal`, {
                size: 10,
                color,
                anchor: 'middle',
                opacity: 0.55,
              })
            );
          }
          const sorted = [...shown].sort(
            (p, q) => estimateRank(scale, p.value) - estimateRank(scale, q.value),
          );
          const spread = estimateSpread(
            scale,
            responses.map((r) => r.value),
          );
          const label = estimateSpreadLabel(spread);
          const chipW = label.length * 6 + 20;
          return (
            picks +
            pill(w / 2 - chipW / 2, tableTop, chipW, 20, color, 0.1) +
            text(w / 2, tableTop + 14, label, {
              size: 10.5,
              weight: 700,
              color,
              anchor: 'middle',
            }) +
            sorted
              .map((r, i) =>
                card(
                  hx + i * 42,
                  tableTop + 30,
                  r.value,
                  spread.kind === 'range' && (r.value === spread.low || r.value === spread.high),
                ),
              )
              .join('')
          );
        },
      );
    }
    case 'temperature': {
      // The card as the face draws it (docs/specs/012-collaboration/temperature-check.md "The face"): the five
      // values, a cool-to-warm bar per value, and the mood
      // meter with the average marked, so an export still says how the room
      // felt.
      const tally = responseTally(el.responses, TEMPERATURE_VALUES);
      const stats = responseStats(el.responses);
      const answered = stats.count;
      return collabCard(
        el,
        title || 'How are we feeling?',
        answered ? `${answered} answered` : undefined,
        color,
        (w, h) => {
          const inner = w - PAD_X * 2;
          const gap = 6;
          const col = (inner - gap * 4) / 5;
          const top = PAD_Y + TITLE_PX + 10;
          // Each value as its face over its number, the buttons as the card draws them.
          const chips = TEMPERATURE_VALUES.map((value, i) => {
            const x = PAD_X + i * (col + gap);
            return (
              `<rect x="${r2(x)}" y="${r2(top)}" width="${r2(col)}" height="40" rx="10" fill="${xmlEscape(color)}" fill-opacity="0.04" stroke="${xmlEscape(color)}" stroke-opacity="0.1"/>` +
              moodFace(x + col / 2, top + 15, 18, i + 1, color, TEMPERATURE_FACE_MOUTHS) +
              text(x + col / 2, top + 35, value, { size: 10, weight: 700, color, anchor: 'middle' })
            );
          }).join('');
          const meterY = h - PAD_Y - 30;
          const barTop = top + 46;
          const barH = Math.max(12, meterY - 10 - barTop);
          const peak = Math.max(1, ...tally);
          const bars = tally
            .map((count, i) => {
              const bw = Math.min(28, col);
              const x = PAD_X + i * (col + gap) + (col - bw) / 2;
              const fill = count ? Math.max(8, (count / peak) * barH) : 0;
              return (
                pill(x, barTop, bw, barH, color, 0.06) +
                (fill
                  ? `<rect x="${r2(x)}" y="${r2(barTop + barH - fill)}" width="${r2(bw)}" height="${r2(fill)}" rx="${r2(Math.min(bw / 2, fill / 2))}" fill="${TEMPERATURE_COLORS[i]}"/>`
                  : '')
              );
            })
            .join('');
          const stops = TEMPERATURE_COLORS.map(
            (c, i) => `<stop offset="${i * 25}%" stop-color="${c}"/>`,
          ).join('');
          const gid = `temp-${xmlEscape(el.id)}`;
          const track =
            `<defs><linearGradient id="${gid}">${stops}</linearGradient></defs>` +
            `<rect x="${r2(PAD_X)}" y="${r2(meterY)}" width="${r2(inner)}" height="8" rx="4" fill="url(#${gid})" opacity="${answered ? 0.9 : 0.25}"/>`;
          const reading =
            stats.average === null || answered === 0
              ? text(PAD_X, meterY + 24, 'No readings yet', { size: 10, color, opacity: 0.45 })
              : `<circle cx="${r2(PAD_X + temperaturePosition(stats.average) * inner)}" cy="${r2(meterY + 4)}" r="6" fill="#ffffff" stroke="${TEMPERATURE_COLORS[Math.round(temperaturePosition(stats.average) * 4)]}" stroke-width="3"/>` +
                text(PAD_X, meterY + 26, stats.average.toFixed(1), {
                  size: 12,
                  weight: 700,
                  color,
                });
          return chips + bars + track + reading;
        },
      );
    }
    case 'idea-box': {
      // Drawn the way the face now looks (docs/specs/012-collaboration/idea-box.md "The look"): the ideas as
      // rows once the box is open, a sealed count while it is closed (never
      // the text), and the composer at the foot.
      const cards = el.ideaCards ?? [];
      const count = cards.length;
      return collabCard(
        el,
        title || 'Ideas',
        count ? `${count} ${count === 1 ? 'idea' : 'ideas'}` : undefined,
        color,
        (w, h) => {
          const composerH = 26;
          const composerY = h - PAD_Y - composerH;
          const composer =
            pill(PAD_X, composerY, w - PAD_X * 2, composerH, color, 0.05) +
            text(PAD_X + 10, composerY + 16.5, 'Add an idea…', { size: 10, color, opacity: 0.45 }) +
            `<circle cx="${r2(w - PAD_X - 13)}" cy="${r2(composerY + composerH / 2)}" r="9" fill="${xmlEscape(color)}" opacity="0.85"/>`;
          const top = PAD_Y + TITLE_PX + 14;
          if (count === 0) {
            return (
              text(PAD_X, top + 14, 'Nothing in the box yet', { size: 10, color, opacity: 0.45 }) +
              composer
            );
          }
          if (el.ideasRevealed !== true) {
            const cy = (top + composerY) / 2;
            // The sealed panel: a tinted plate, the lock in its disc, the count.
            return (
              `<rect x="${r2(PAD_X)}" y="${r2(cy - 52)}" width="${r2(w - PAD_X * 2)}" height="96" rx="12" fill="${xmlEscape(color)}" fill-opacity="0.04" stroke="${xmlEscape(color)}" stroke-opacity="0.08"/>` +
              `<circle cx="${r2(w / 2)}" cy="${r2(cy - 26)}" r="14" fill="${xmlEscape(color)}" fill-opacity="0.14"/>` +
              lockMark(w / 2, cy - 26, 15, color) +
              text(w / 2, cy + 6, String(count), {
                size: 22,
                weight: 700,
                color,
                anchor: 'middle',
              }) +
              text(w / 2, cy + 22, count === 1 ? 'idea sealed' : 'ideas sealed', {
                size: 10,
                weight: 600,
                color,
                anchor: 'middle',
                opacity: 0.7,
              }) +
              composer
            );
          }
          const rowH = 26;
          const fit = Math.max(1, Math.floor((composerY - top - 6) / rowH));
          const maxChars = Math.max(8, Math.floor((w - PAD_X * 2 - 16) / 5.6));
          const rows = cards
            .slice(0, fit)
            .map((card, i) => {
              const y = top + i * rowH;
              const body = card.length > maxChars ? `${card.slice(0, maxChars - 1)}…` : card;
              return (
                pill(PAD_X, y, w - PAD_X * 2, rowH - 5, color, 0.06) +
                text(PAD_X + 8, y + 14, body, { size: 10.5, color })
              );
            })
            .join('');
          return rows + composer;
        },
      );
    }
    case 'qa-board': {
      // The ranked queue as it stood: a vote pill and the note per row, the
      // spotlit note first, so an exported board still says what the room
      // asked and what it wanted most (docs/specs/012-collaboration/qa-board.md).
      const { discussing, queue, done } = qaView(el.qaNotes);
      const rows = discussing ? [discussing, ...queue] : queue;
      const total = rows.length + done.length;
      return collabCard(
        el,
        title || 'Questions',
        total ? `${total} ${total === 1 ? 'note' : 'notes'}` : undefined,
        color,
        (w, h) => {
          if (rows.length === 0) {
            return text(PAD_X, PAD_Y + TITLE_PX + 28, 'No notes yet', {
              size: 10,
              color,
              opacity: 0.45,
            });
          }
          const rowH = 30;
          const top = PAD_Y + TITLE_PX + 14;
          const fit = Math.max(1, Math.floor((h - top - PAD_Y) / rowH));
          const maxChars = Math.max(8, Math.floor((w - PAD_X * 2 - 44) / 5.6));
          return rows
            .slice(0, fit)
            .map((n, i) => {
              const y = top + i * rowH;
              const body = n.text.length > maxChars ? `${n.text.slice(0, maxChars - 1)}…` : n.text;
              return (
                pill(PAD_X, y, w - PAD_X * 2, rowH - 6, color, n === discussing ? 0.16 : 0.06) +
                pill(PAD_X + 5, y + 4, 30, rowH - 14, color, 0.14) +
                text(PAD_X + 20, y + 16.5, String(n.voters.length), {
                  size: 10,
                  weight: 600,
                  color,
                  anchor: 'middle',
                }) +
                text(PAD_X + 42, y + 16.5, body, { size: 10.5, color })
              );
            })
            .join('');
        },
      );
    }
    case 'agenda': {
      // The stepper as the face draws it (docs/specs/012-collaboration/agenda.md "The face"): a rail with a
      // marker per segment, done ones checked, the current one filled, each
      // with its minutes.
      const items = el.agendaItems ?? [];
      const total = agendaTotalMinutes(items);
      const current = el.agendaCurrent;
      return collabCard(
        el,
        title || 'Agenda',
        items.length ? `${total}m` : undefined,
        color,
        (w, h) => {
          if (items.length === 0) {
            return text(PAD_X, PAD_Y + TITLE_PX + 16, 'No segments yet', {
              size: 10,
              color,
              opacity: 0.45,
            });
          }
          const top = PAD_Y + TITLE_PX + 16;
          const step = 22;
          const fit = Math.max(1, Math.floor((h - top - PAD_Y) / step));
          const shown = items.slice(0, fit);
          const railX = PAD_X + 6;
          const rail =
            shown.length > 1
              ? `<line x1="${r2(railX)}" y1="${r2(top)}" x2="${r2(railX)}" y2="${r2(top + (shown.length - 1) * step)}" stroke="${xmlEscape(color)}" stroke-opacity="0.18" stroke-width="2"/>`
              : '';
          return (
            rail +
            shown
              .map((item, i) => {
                const y = top + i * step;
                const done = current !== undefined && i < current;
                const now = current === i;
                const marker = now
                  ? `<circle cx="${r2(railX)}" cy="${r2(y)}" r="6" fill="${xmlEscape(color)}"/>`
                  : `<circle cx="${r2(railX)}" cy="${r2(y)}" r="5.5" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="${done ? 0.8 : 0.35}" stroke-width="2"/>`;
                return (
                  marker +
                  text(railX + 14, y + 4, item.label, {
                    size: BODY_PX,
                    weight: now ? 600 : 400,
                    color,
                    opacity: done ? 0.5 : 1,
                  }) +
                  text(w - PAD_X, y + 4, `${item.minutes}m`, {
                    size: 10,
                    color,
                    anchor: 'end',
                    opacity: 0.55,
                  })
                );
              })
              .join('')
          );
        },
      );
    }
    case 'decision': {
      // The card as the face draws it (docs/specs/012-collaboration/decision-record.md "The face"): the status
      // as a badge with its glyph in the status hue, a soft glow of it from the
      // top corner, the drivers under "Because" with arrow markers, the date.
      const status = el.decisionStatus ?? DEFAULT_DECISION_STATUS;
      const hue = DECISION_STATUS_HUES[status];
      const drivers = el.decisionDrivers ?? [];
      const labelText = DECISION_STATUS_LABELS[status];
      // The frame draws no title here: the statement wraps to three lines in
      // the room left of the badge, at the size the canvas sets it (15px).
      return collabCard(el, '', undefined, color, (w, h) => {
        const badgeW = labelText.length * 6 + 30;
        const bx = w - PAD_X - badgeW;
        const by = PAD_Y + 1;
        const badge =
          pill(bx, by, badgeW, 18, hue, 0.16) +
          statusGlyph(status, bx + 11, by + 9, hue) +
          text(bx + 20, by + 12.5, labelText, { size: 10, weight: 600, color: hue });
        const statement = wrapLines(title || 'We will …', w - PAD_X * 2 - badgeW - 8, 15, 3);
        const heading = statement
          .map((line, i) =>
            text(PAD_X, PAD_Y + 14 + i * 19, line, { size: 15, weight: 600, color }),
          )
          .join('');
        const top = PAD_Y + 14 + (statement.length - 1) * 19 + 26;
        const head = heading + text(PAD_X, top, 'BECAUSE', { size: 8.5, weight: 700, color: hue });
        const body = drivers.length
          ? drivers
              .slice(0, 5)
              .map((d, i) => {
                const y = top + 18 + i * 18;
                return (
                  `<circle cx="${r2(PAD_X + 6)}" cy="${r2(y - 4)}" r="6" fill="${xmlEscape(hue)}" fill-opacity="0.16"/>` +
                  text(PAD_X + 6, y - 1, '→', {
                    size: 8,
                    weight: 700,
                    color: hue,
                    anchor: 'middle',
                  }) +
                  text(PAD_X + 18, y, d, { size: BODY_PX, color })
                );
              })
              .join('')
          : text(PAD_X, top + 18, '+ Add what drove this from the element’s menu.', {
              size: 10,
              color,
              opacity: 0.45,
            });
        const dateW = (el.decisionDate?.length ?? 0) * 5.8 + 16;
        const date = el.decisionDate
          ? pill(PAD_X, h - PAD_Y - 18, dateW, 18, color, 0.07) +
            text(PAD_X + 8, h - PAD_Y - 5.5, el.decisionDate, { size: 10, color, opacity: 0.75 })
          : '';
        return (
          glow(`decision-${el.id}`, 0, 0, w, h, hue, { cx: 0, cy: 0 }, 0.16, 10) +
          badge +
          head +
          body +
          date
        );
      });
    }
    case 'roll-call': {
      // The card as the face draws it (docs/specs/012-collaboration/roll-call.md "The face"): a header block
      // with the count large, an overlapping stack of the first few people as
      // initial discs on their colours, and the time taken; then everyone as a
      // chip; Take roll at the foot.
      const entries = el.rollCall ?? [];
      return collabCard(el, title || 'Roll call', undefined, color, (w, h) => {
        const inner = w - PAD_X * 2;
        const foot =
          `<rect x="${r2(PAD_X)}" y="${r2(h - PAD_Y - 28)}" width="${r2(inner)}" height="28" rx="10" fill="${xmlEscape(color)}" fill-opacity="0.05" stroke="${xmlEscape(color)}" stroke-opacity="0.35" stroke-dasharray="4 3"/>` +
          text(w / 2, h - PAD_Y - 10, entries.length ? 'Take again' : 'Take roll', {
            size: 11,
            weight: 600,
            color,
            anchor: 'middle',
          });
        if (entries.length === 0) {
          return (
            text(w / 2, (PAD_Y + TITLE_PX + h - PAD_Y - 28) / 2, 'Nobody recorded yet', {
              size: 11,
              weight: 600,
              color,
              anchor: 'middle',
            }) + foot
          );
        }
        const top = PAD_Y + TITLE_PX + 10;
        const person = (e: RollCallEntry) => ({ initials: initialsOf(e.name), fill: e.color });
        const block =
          `<rect x="${r2(PAD_X)}" y="${r2(top)}" width="${r2(inner)}" height="46" rx="12" fill="${xmlEscape(color)}" fill-opacity="0.04"/>` +
          text(PAD_X + 12, top + 26, String(entries.length), { size: 20, weight: 700, color }) +
          text(PAD_X + 12, top + 38, 'PRESENT', { size: 8, weight: 600, color, opacity: 0.55 }) +
          entries
            .slice(0, 5)
            .map((e, i) =>
              personDisc(PAD_X + 70 + i * 19, top + 23, 11, color, person(e), '#ffffff'),
            )
            .join('');
        let cx = PAD_X;
        let cy = top + 58;
        const chips = entries
          .slice(0, 12)
          .map((e) => {
            const cw = Math.min(inner, e.name.length * 5.6 + 34);
            if (cx + cw > PAD_X + inner) {
              cx = PAD_X;
              cy += 26;
            }
            if (cy + 22 > h - PAD_Y - 34) return '';
            const out =
              pill(cx, cy, cw, 22, color, 0.06) +
              personDisc(cx + 11, cy + 11, 9, color, person(e)) +
              text(cx + 24, cy + 15, e.name, { size: 10.5, weight: 500, color });
            cx += cw + 6;
            return out;
          })
          .join('');
        return block + chips + foot;
      });
    }
    case 'quiz': {
      // Quiz (docs/specs/012-collaboration/quiz.md): the disc and its ring of answers. A still image
      // cannot run a countdown, so an unrevealed card exports as the closed
      // disc (the question stays hidden, as it is on the board) and a revealed
      // one exports the question with the right answer in green.
      const scale = Math.min(el.width, el.height) / QUIZ_DESIGN_SIZE;
      const ox = el.x + (el.width - QUIZ_DESIGN_SIZE * scale) / 2;
      const oy = el.y + (el.height - QUIZ_DESIGN_SIZE * scale) / 2;
      const c = QUIZ_DESIGN_SIZE / 2;
      const revealed = el.quizRevealed === true;
      const options = el.quizOptions ?? [];
      const tally = quizTally(el);
      const disc =
        `<circle cx="${c}" cy="${c}" r="${QUIZ_DISC_RADIUS}" fill="${xmlEscape(color)}" opacity="0.07"/>` +
        (el.strokeColor && stroke
          ? `<circle cx="${c}" cy="${c}" r="${QUIZ_DISC_RADIUS}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="3"/>`
          : `<circle cx="${c}" cy="${c}" r="${QUIZ_DISC_RADIUS}" fill="none" stroke="${xmlEscape(color)}" stroke-width="2" opacity="0.3"/>`);
      const centre = revealed
        ? text(c, c - 6, title.length > 34 ? `${title.slice(0, 33)}…` : title, {
            size: 13,
            weight: 600,
            color,
            anchor: 'middle',
          }) +
          text(
            c,
            c + 16,
            `${quizCorrectKeys(el).length} of ${(el.responses ?? []).length} correct`,
            {
              size: 10,
              color,
              anchor: 'middle',
              opacity: 0.6,
              uppercase: true,
            },
          )
        : text(c, c + 16, '?', { size: 48, weight: 700, color, anchor: 'middle', opacity: 0.8 });
      const answers = revealed
        ? quizOptionCentres(options.length)
            .map((p, i) => {
              const right = i === el.quizCorrect;
              const x = p.x - QUIZ_OPTION_WIDTH / 2;
              const y = p.y - QUIZ_OPTION_HEIGHT / 2;
              const body = options[i] ?? '';
              return (
                `<rect x="${r2(x)}" y="${r2(y)}" width="${QUIZ_OPTION_WIDTH}" height="${QUIZ_OPTION_HEIGHT}" rx="14"` +
                ` fill="${right ? QUIZ_CORRECT_GREEN : xmlEscape(color)}" opacity="${right ? 1 : 0.1}"/>` +
                text(p.x, p.y + 4, body.length > 18 ? `${body.slice(0, 17)}…` : body, {
                  size: 12,
                  weight: 600,
                  color: right ? '#ffffff' : color,
                  anchor: 'middle',
                }) +
                text(p.x, y + QUIZ_OPTION_HEIGHT - 6, String(tally[i] ?? 0), {
                  size: 9,
                  color: right ? '#ffffff' : color,
                  anchor: 'middle',
                  opacity: 0.7,
                })
              );
            })
            .join('')
        : '';
      return (
        `<g transform="translate(${r2(ox)} ${r2(oy)}) scale(${r2(scale)})">` +
        disc +
        centre +
        answers +
        `</g>`
      );
    }
    case 'done-check': {
      // The card as the face draws it (docs/specs/012-collaboration/done-check.md "Reading the card"): the ring
      // at the share of marks it holds, the count in it, and the button. An
      // export has no room to count against, so the ring reads the marks as
      // the whole: done when there are any, drawn at full.
      const done = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'Everyone done?',
        done ? `${done} done` : undefined,
        color,
        (w, h) => {
          const r = 30;
          const cx = PAD_X + r + 4;
          const cy = PAD_Y + TITLE_PX + 12 + r;
          const circ = 2 * Math.PI * r;
          const arc = done
            ? `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-dasharray="${r2(circ)}" stroke-dashoffset="0" transform="rotate(-90 ${r2(cx)} ${r2(cy)})"/>`
            : '';
          return (
            `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="0.12" stroke-width="7"/>` +
            arc +
            (done
              ? checkMark(cx, cy, 26, '#22c55e', 2.6)
              : text(cx, cy + 6, '0', { size: 18, weight: 700, color, anchor: 'middle' })) +
            // Who is done, as the roster: an export has no names for them (a
            // done check stores an opaque key per mark), so neutral discs,
            // each wearing the green check.
            (done
              ? text(cx + r + 18, cy - 14, 'DONE', { size: 9, weight: 700, color, opacity: 0.6 }) +
                Array.from({ length: Math.min(done, 6) }, (_, i) => {
                  const px = cx + r + 30 + i * 26;
                  return (
                    personDisc(px, cy + 6, 10, color) +
                    `<circle cx="${r2(px + 8)}" cy="${r2(cy + 14)}" r="5" fill="#22c55e"/>` +
                    checkMark(px + 8, cy + 14, 7, '#ffffff', 1.6)
                  );
                }).join('') +
                (done > 6
                  ? text(cx + r + 30 + 6 * 26, cy + 10, `+${done - 6}`, {
                      size: 10,
                      weight: 700,
                      color,
                      opacity: 0.6,
                    })
                  : '')
              : text(cx + r + 18, cy + 4, 'Nobody done yet', { size: 11, weight: 600, color })) +
            pill(PAD_X, h - PAD_Y - 26, w - PAD_X * 2, 26, color, 0.16) +
            text(w / 2, h - PAD_Y - 9, "I'm done", {
              size: 11,
              weight: 600,
              color,
              anchor: 'middle',
            })
          );
        },
      );
    }
    default:
      return null;
  }
}

/** The Decision record status glyph (as its badge draws it), centred at (cx, cy). */
function statusGlyph(status: string, cx: number, cy: number, hue: string): string {
  const k = `stroke="${xmlEscape(hue)}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  if (status === 'accepted') return checkMark(cx, cy, 11, hue, 1.6);
  if (status === 'rejected')
    return `<path d="M ${r2(cx - 3)} ${r2(cy - 3)} L ${r2(cx + 3)} ${r2(cy + 3)} M ${r2(cx + 3)} ${r2(cy - 3)} L ${r2(cx - 3)} ${r2(cy + 3)}" ${k}/>`;
  if (status === 'superseded')
    return `<path d="M ${r2(cx - 3.5)} ${r2(cy + 2)} a 3.5 3.5 0 0 1 6 -2.5 M ${r2(cx + 3)} ${r2(cy - 3.5)} v 2.5 h -2.5" ${k}/>`;
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="3.2" ${k} stroke-dasharray="1.6 1.6"/>`;
}

/** Break `body` into at most `max` lines that fit `width` at `size`px (an
 *  estimate of the face's advance), the last one ending in an ellipsis when
 *  the text runs on: the export's version of the canvas's line clamp. */
function wrapLines(body: string, width: number, size: number, max: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = body.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === max) break;
  }
  if (line && lines.length < max) lines.push(line);
  const used = lines.join(' ').length;
  if (lines.length === max && used < body.trim().length) {
    lines[max - 1] = `${lines[max - 1]!.slice(0, perLine - 1).trimEnd()}…`;
  }
  return lines;
}
