// The board view's own script (liveplanner's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): a tab's
// boards drawn as plain HTML, columns side by side and their cards in order, each card a button that opens the editor
// at it. Every word on it is set as text, never markup, so nothing the plan holds can run in the frame. It joins the
// shared pure parts, host wiring and live updates (app-viewer-script.ts, "Live updates": a card written, moved or
// retyped draws the board again, its scroll and a focused card kept); its own pure parts sit on `LDB` for the tests.
import {
  boardConstants,
  joinViewerScript,
  LIVE_SCRIPT,
  type ViewerScriptOptions,
} from './app-viewer-script';

const BOARD = String.raw`
  var LDB = {
    // A column's count as its header shows it: the cards, against its WIP limit when it has one.
    countOf: function (c) { return c.wipLimit ? c.count + ' / ' + c.wipLimit : String(c.count); },
    // The cards a column holds past the ones drawn.
    moreOf: function (c) { return Math.max(0, c.count - c.cards.length); }
  };
  var boardEl = $('board'), tabsEl = $('tabs'), shown = null, subject = null;
  // No edit parts on a board: live updates' redraw never waits on one.
  var ED = null;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function drawTabs() {
    tabsEl.textContent = '';
    if (!shown || shown.tabs.length < 2) { tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    shown.tabs.forEach(function (t) {
      var b = el('button', '', t.name);
      b.type = 'button';
      b.title = 'Show ' + t.name;
      b.setAttribute('aria-pressed', String(t.id === shown.tabId));
      b.onclick = function () { if (t.id !== shown.tabId) load(subject.documentId, t.id); };
      tabsEl.appendChild(b);
    });
  }
  function drawCard(list, s, b, card) {
    var li = el('li');
    var btn = el('button', 'card');
    btn.type = 'button';
    btn.title = 'Open ' + card.ref + ' ' + card.title + ' in the editor';
    btn.dataset.card = card.id;
    if (card.color) btn.style.borderLeftColor = card.color;
    btn.appendChild(el('span', 'ref', card.ref));
    btn.appendChild(el('span', 'tt', card.title));
    btn.onclick = function () { open(LDV.elementLink(s.url, s.tabId, b.id, card.id)); };
    li.appendChild(btn);
    list.appendChild(li);
  }
  function drawColumn(row, s, b, c) {
    var col = el('section', c.done ? 'col done' : 'col');
    col.setAttribute('aria-label', c.name + ', ' + c.count + (c.count === 1 ? ' card' : ' cards'));
    var head = el('header', 'ch');
    head.appendChild(el('span', 'cn', c.name));
    var n = el('span', c.wipLimit && c.count > c.wipLimit ? 'n over' : 'n', LDB.countOf(c));
    if (c.wipLimit) n.title = 'WIP limit ' + c.wipLimit;
    head.appendChild(n);
    col.appendChild(head);
    var list = el('ul', 'cards');
    c.cards.forEach(function (card) { drawCard(list, s, b, card); });
    col.appendChild(list);
    if (c.count === 0) col.appendChild(el('p', 'empty', 'No cards'));
    var more = LDB.moreOf(c);
    if (more > 0) {
      var m = el('button', 'more', '+ ' + more + ' more');
      m.type = 'button';
      m.title = 'Open the board in the editor to see every card';
      m.onclick = function () { open(LDV.elementLink(s.url, s.tabId, b.id)); };
      col.appendChild(m);
    }
    row.appendChild(col);
  }
  function draw(s) {
    boardEl.textContent = '';
    s.boards.forEach(function (b) {
      var sec = el('section', 'bd');
      sec.setAttribute('aria-label', b.title);
      if (s.boards.length > 1) sec.appendChild(el('h2', 'bt', b.title));
      var row = el('div', 'cols');
      b.columns.forEach(function (c) { drawColumn(row, s, b, c); });
      sec.appendChild(row);
      boardEl.appendChild(sec);
    });
  }
  // What a live redraw keeps: where the board is scrolled, and the card that held focus (found again by its id).
  function placeOf() {
    var a = document.activeElement;
    return { top: boardEl.scrollTop, left: boardEl.scrollLeft, card: a && a.dataset ? a.dataset.card : null };
  }
  function keepPlace(at) {
    boardEl.scrollTop = at.top;
    boardEl.scrollLeft = at.left;
    if (!at.card) return;
    var cards = boardEl.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) if (cards[i].dataset.card === at.card) return cards[i].focus({ preventScroll: true });
  }
  // Draws a tab's boards; quiet (a live redraw) keeps the scroll and focus, says nothing, and drops a stale answer.
  function load(documentId, tabId, quiet) {
    if (!quiet) { subject = { documentId: documentId, tabId: tabId }; say('Loading…'); }
    request('tools/call', { name: 'view_tab', arguments: viewArgs(documentId, { tabId: tabId }) }).then(function (res) {
      var s = res && res.structuredContent;
      if (!s || res.isError || !Array.isArray(s.boards)) throw new Error('no view');
      if (quiet && (subject.documentId !== documentId || subject.tabId !== s.tabId)) return;
      var at = quiet ? placeOf() : null;
      shown = s;
      subject.tabId = s.tabId;
      lastDraw = Date.now();
      $('title').textContent = s.name;
      drawTabs();
      draw(s);
      if (at) keepPlace(at);
      say(s.boards.length ? '' : 'This plan has no board yet.');
      if (LIVE_ON) follow(documentId);
    }).catch(function () {
      if (quiet) return;
      shown = null; boardEl.textContent = ''; say('This board could not be shown.');
    });
  }
  function quietLoad() { if (subject && shown) load(subject.documentId, subject.tabId, true); }
  $('open').onclick = function () { if (shown) open(LDV.elementLink(shown.url, shown.tabId, null)); };
`;

const BOARD_START = String.raw`
  start(function (found) { load(found.documentId, found.tabId); });
`;

/** The board view's script for a product: its file named by `opts.idKey`, following the room unless `live` is false. */
export function boardViewerScript(app: string, opts: ViewerScriptOptions = {}): string {
  return joinViewerScript(BOARD + LIVE_SCRIPT + BOARD_START, boardConstants(app, opts));
}
