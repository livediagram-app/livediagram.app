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
  estimateValues,
  TEMPERATURE_COLORS,
  TEMPERATURE_VALUES,
  temperaturePosition,
} from './collab-shapes';
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
  collabCard,
  footerPills,
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
      // The card as the face draws it (docs/specs/012-collaboration/estimate-card.md "The look"): the scale's
      // cards, then, once revealed, every answer face up low to high with the
      // spread; hidden answers stay hidden in the export too.
      const scale = el.estimateScale;
      const values = estimateValues(scale);
      const responses = el.responses ?? [];
      const revealed = el.responsesRevealed === true;
      return collabCard(
        el,
        title || 'Estimate',
        responses.length ? `${responses.length} answered` : undefined,
        color,
        (w, h) => {
          const inner = w - PAD_X * 2;
          const gap = 5;
          const cw = Math.min(46, (inner - gap * (values.length - 1)) / values.length);
          const rowW = cw * values.length + gap * (values.length - 1);
          const x0 = PAD_X + (inner - rowW) / 2;
          const top = PAD_Y + TITLE_PX + 10;
          const picks = values
            .map((v, i) => {
              const x = x0 + i * (cw + gap);
              return (
                pill(x, top, cw, 40, color, 0.06) +
                text(x + cw / 2, top + 24, v, { size: 13, weight: 700, color, anchor: 'middle' })
              );
            })
            .join('');
          const mid = (top + 40 + h - PAD_Y) / 2;
          if (responses.length === 0) {
            return (
              picks +
              text(w / 2, mid, 'No picks yet', { size: 10, color, anchor: 'middle', opacity: 0.45 })
            );
          }
          if (!revealed) {
            return (
              picks +
              text(w / 2, mid, `${responses.length} in, hidden until the reveal`, {
                size: 10,
                color,
                anchor: 'middle',
                opacity: 0.6,
              })
            );
          }
          const sorted = responses
            .map((r) => r.value)
            .sort((p, q) => estimateRank(scale, p) - estimateRank(scale, q));
          const answers = sorted.join('  ');
          return (
            picks +
            text(w / 2, mid - 8, estimateSpreadLabel(estimateSpread(scale, sorted)), {
              size: 11,
              weight: 700,
              color,
              anchor: 'middle',
            }) +
            text(w / 2, mid + 12, answers, { size: 12, weight: 600, color, anchor: 'middle' })
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
          const chips = TEMPERATURE_VALUES.map((value, i) => {
            const x = PAD_X + i * (col + gap);
            return (
              pill(x, top, col, 34, color, 0.06) +
              text(x + col / 2, top + 21.5, value, {
                size: 12,
                weight: 700,
                color,
                anchor: 'middle',
              })
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
            return (
              text(w / 2, cy, String(count), { size: 22, weight: 700, color, anchor: 'middle' }) +
              text(w / 2, cy + 16, count === 1 ? 'idea sealed' : 'ideas sealed', {
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
      // The card as the face draws it (docs/specs/012-collaboration/decision-record.md "The face"): its real
      // status (it always printed "Proposed"), the drivers under "Because",
      // each with an arrow in the status colour, and the date.
      const status = el.decisionStatus ?? DEFAULT_DECISION_STATUS;
      const hue = DECISION_STATUS_HUES[status];
      const drivers = el.decisionDrivers ?? [];
      return collabCard(
        el,
        title || 'We will …',
        DECISION_STATUS_LABELS[status],
        color,
        (_w, h) => {
          const top = PAD_Y + TITLE_PX + 22;
          const head = text(PAD_X, top, 'BECAUSE', { size: 8.5, weight: 700, color: hue });
          const body = drivers.length
            ? drivers
                .slice(0, 5)
                .map(
                  (d, i) =>
                    text(PAD_X, top + 16 + i * 16, '→', { size: 10, weight: 700, color: hue }) +
                    text(PAD_X + 12, top + 16 + i * 16, d, { size: BODY_PX, color }),
                )
                .join('')
            : text(PAD_X, top + 16, 'No drivers yet', { size: 10, color, opacity: 0.45 });
          const date = el.decisionDate
            ? text(PAD_X, h - PAD_Y - 4, el.decisionDate, { size: 10, color, opacity: 0.6 })
            : '';
          return head + body + date;
        },
      );
    }
    case 'roll-call': {
      const entries = el.rollCall ?? [];
      return collabCard(
        el,
        title || 'Roll call',
        entries.length ? `${entries.length} present` : undefined,
        color,
        (_w, h) =>
          (entries.length
            ? entries
                .slice(0, 6)
                .map((e, i) =>
                  text(PAD_X, PAD_Y + TITLE_PX + 20 + i * 15, e.name ?? '', {
                    size: BODY_PX,
                    color,
                  }),
                )
                .join('')
            : text(PAD_X, PAD_Y + TITLE_PX + 20, 'Nobody recorded yet', {
                size: 10,
                color,
                opacity: 0.45,
              })) + footerPills(PAD_X, h - PAD_Y - 18, ['Take roll'], color),
      );
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
            text(cx, cy + 6, String(done), { size: 18, weight: 700, color, anchor: 'middle' }) +
            text(cx + r + 18, cy - 4, done ? `${done} marked done` : 'Nobody done yet', {
              size: 11,
              weight: 600,
              color,
            }) +
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
