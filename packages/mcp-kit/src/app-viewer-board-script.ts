// The board view's own script (liveplanner's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): a tab's
// boards drawn as plain HTML, columns side by side and their cards in order, each card a button that opens the editor
// at it. Every word on it is set as text, never markup, so nothing the plan holds can run in the frame. It joins the
// shared pure parts and host wiring (app-viewer-script.ts); its own pure parts sit on `LDB` for the tests.
import { boardConstants, joinViewerScript } from './app-viewer-script';

const BOARD = String.raw`
  var LDB = {
    // A column's count as its header shows it: the cards, against its WIP limit when it has one.
    countOf: function (c) { return c.wipLimit ? c.count + ' / ' + c.wipLimit : String(c.count); },
    // The cards a column holds past the ones drawn.
    moreOf: function (c) { return Math.max(0, c.count - c.cards.length); }
  };
  var boardEl = $('board'), tabsEl = $('tabs'), shown = null, subject = null;
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
  function load(documentId, tabId) {
    subject = { documentId: documentId, tabId: tabId };
    say('Loading…');
    request('tools/call', { name: 'view_tab', arguments: viewArgs(documentId, { tabId: tabId }) }).then(function (res) {
      var s = res && res.structuredContent;
      if (!s || res.isError || !Array.isArray(s.boards)) throw new Error('no view');
      shown = s;
      $('title').textContent = s.name;
      drawTabs();
      draw(s);
      say(s.boards.length ? '' : 'This plan has no board yet.');
    }).catch(function () {
      shown = null; boardEl.textContent = ''; say('This board could not be shown.');
    });
  }
  $('open').onclick = function () { if (shown) open(LDV.elementLink(shown.url, shown.tabId, null)); };
  start(function (found) { load(found.documentId, found.tabId); });
`;

/** The board view's script for a product, its file named by `idKey`. */
export function boardViewerScript(app: string, idKey: string): string {
  return joinViewerScript(BOARD, boardConstants(app, idKey));
}
