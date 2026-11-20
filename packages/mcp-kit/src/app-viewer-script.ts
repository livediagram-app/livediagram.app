// The interactive view's script (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"), as the text the page
// inlines: plain strings, never a function's source, so no bundler helper leaks into the sandboxed frame. It talks to
// the host over postMessage JSON-RPC (the io.modelcontextprotocol/ui extension): ui/initialize, then the tool's result
// arrives as ui/notifications/tool-result; the tab is read with tools/call view_tab and drawn as an <img> of its SVG,
// so nothing in the SVG runs or fetches. A tab of pages shows one page at a time, with a pager. Every view (the board's
// too) follows its file live once drawn ("Live updates"): a view-only ticket from tools/call view_live opens the room's
// socket, which it only listens on, and a change to what it shows draws it again. Where the page edits (livediagram,
// "Edits in the view") and view_live says the token may, an Edit toggle lets
// the person rename and move elements, each finished gesture one tools/call view_edit. A view follows until an agent's
// later change lands on its tab ("One live view"): it then keeps its own step, the picture its result came with when
// it is opened again. Its pure parts sit on `LDV`
// (subjectOf, pictureOf, fitOf, zoomAt, hitTest, elementLink, pagerOf, changeOf, retryAfter, stopWords, nudgeOf,
// moveOf, stepOf, hintOf) for the tests, which evaluate this text with no window; the wiring runs only in a page.
//
// The script is four parts: the pure `LDV`, the host wiring every view shares (`HOST`), live updates (`LIVE`), and the
// view's own (the canvas here, with its edit parts when asked, the board in app-viewer-board-script.ts), joined by
// `viewerScript`.

import { EDIT, EDIT_PURE } from './app-viewer-edit-script';

// The pure parts, shared by every view.
const PURE = String.raw`
var LDV = (function () {
  var MIN = 0.05, MAX = 8;
  // Live updates' numbers (the spec's LIVE_*): one redraw per REDRAW_MS at most, reconnects from MIN_MS doubling to
  // MAX_MS, MAX_ATTEMPTS tries without an open socket, and a fresh ticket RENEW_BEFORE_MS before one lapses.
  var LIVE = { REDRAW_MS: 1500, MIN_MS: 1000, MAX_MS: 30000, MAX_ATTEMPTS: 6, RENEW_BEFORE_MS: 30000 };
  // The ops that change what a view shows, or say a change was saved (tab-saved: view_tab now reads it), in every
  // product's room: a design's photo layers and component mains, and a plan's cards and card types besides.
  var CONTENT = { tab: 1, el: 1, 'tab-meta': 1, 'el-delta': 1, vote: 1, qa: 1, changeset: 1, 'tab-saved': 1,
    photo: 1, component: 1, items: 1, 'item-types': 1 };
  // A file's tab list changing, and the file going to the Trash, by each product's name for its file.
  var META = { 'document-meta': 1, 'design-meta': 1, 'project-meta': 1 };
  var TRASHED = { 'document-trashed': 1, 'design-trashed': 1, 'project-trashed': 1 };
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return typeof v === 'string' && v.length > 0 ? v : null; }
  // The picture a tool's result came with (its PNG block), as an image address; null when it came with none.
  function pictureOf(result) {
    var c = result && Array.isArray(result.content) ? result.content : [];
    for (var i = 0; i < c.length; i++)
      if (c[i] && c[i].type === 'image' && str(c[i].data) && str(c[i].mimeType)) return 'data:' + c[i].mimeType + ';base64,' + c[i].data;
    return null;
  }
  // The file and tab a tool's result names, whatever the product calls the file: create (documentId, tabIds),
  // add_tab and update (documentId, tabId), a read (id, tab.id); designId and projectId alike. With them, the step
  // the view was opened by ("One live view"): the tab's revision as the result left it, and the result's picture.
  function subjectOf(result) {
    var s = result && typeof result === 'object' ? result.structuredContent : null;
    if (!s || typeof s !== 'object') return null;
    var doc = str(s.documentId) || str(s.designId) || str(s.projectId) || str(s.id);
    if (!doc) return null;
    var tab = str(s.tabId) || (s.tab && str(s.tab.id)) || (Array.isArray(s.tabIds) ? str(s.tabIds[0]) : null);
    var rev = num(s.rev) ? s.rev : s.tab && num(s.tab.rev) ? s.tab.rev : null;
    return { documentId: doc, tabId: tab, rev: rev, picture: pictureOf(result) };
  }
  // The scale and offset that fit a w x h picture into a box, with a margin, never past 1:1 * 2.
  function fitOf(w, h, boxW, boxH) {
    if (!(w > 0 && h > 0 && boxW > 0 && boxH > 0)) return { scale: 1, x: 0, y: 0 };
    var scale = Math.min((boxW - 24) / w, (boxH - 24) / h, 2);
    scale = Math.max(MIN, scale);
    return { scale: scale, x: (boxW - w * scale) / 2, y: (boxH - h * scale) / 2 };
  }
  // The view zoomed by factor about the point (px, py) of the box, held within MIN and MAX.
  function zoomAt(view, factor, px, py) {
    var scale = Math.min(MAX, Math.max(MIN, view.scale * factor));
    var k = scale / view.scale;
    return { scale: scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
  }
  // The topmost element under the box point (px, py): the view maps it to the tab's own coordinates.
  function hitTest(view, viewBox, elements, px, py) {
    var x = (px - view.x) / view.scale + viewBox.x;
    var y = (py - view.y) / view.scale + viewBox.y;
    for (var i = elements.length - 1; i >= 0; i--) {
      var e = elements[i];
      if (x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height) return e;
    }
    return null;
  }
  // The editor at an element (the Inbox's element deep link), at a card on its board (&item=), or at the tab.
  function elementLink(url, tabId, elementId, itemId) {
    var hash = 't=' + encodeURIComponent(tabId);
    if (elementId) hash += '&el=' + encodeURIComponent(elementId);
    if (itemId) hash += '&item=' + encodeURIComponent(itemId);
    return url.split('#')[0] + '#' + hash;
  }
  // Where the shown page sits among the tab's pages: its place, the label ("2 / 7") and the pages either side; null
  // for a tab of one page or none, which shows no pager.
  function pagerOf(pages, pageId) {
    if (!Array.isArray(pages) || pages.length < 2) return null;
    var at = 0;
    for (var i = 0; i < pages.length; i++) if (pages[i].id === pageId) at = i;
    return {
      at: at,
      label: at + 1 + ' / ' + pages.length,
      name: pages[at].name,
      prev: at > 0 ? pages[at - 1].id : null,
      next: at < pages.length - 1 ? pages[at + 1].id : null
    };
  }
  // What a room frame means for the shown tab: draw it again, the document went to the Trash, an agent's later
  // change landed on it (later: the view keeps its own step), or nothing. A changeset in own (the view's own edits,
  // already drawn from view_edit's answer) draws nothing.
  function changeOf(frame, tabId, own) {
    var op = frame && frame.kind === 'op' ? frame.op : null;
    if (!op || typeof op.kind !== 'string') return null;
    if (TRASHED[op.kind] === 1) return 'trashed';
    if (META[op.kind] === 1) return 'redraw';
    if (op.kind === 'changeset' && own && own.indexOf(op.id) >= 0) return null;
    if (CONTENT[op.kind] !== 1 || (op.tabId && op.tabId !== tabId)) return null;
    return op.kind === 'changeset' && str(op.agentKey) ? 'later' : 'redraw';
  }
  // The wait before reconnect try number tries (from 0), or -1 once they have run out.
  function retryAfter(tries) {
    return tries >= LIVE.MAX_ATTEMPTS ? -1 : Math.min(LIVE.MAX_MS, LIVE.MIN_MS * Math.pow(2, tries));
  }
  // Why live updates stopped, in the product's word for its file (a document, a design, a plan).
  function stopWords(why, word) {
    var w = word || 'document';
    if (why === 'trashed') return 'This ' + w + ' moved to the Trash.';
    if (why === 'archived') return 'This ' + w + ' was archived.';
    if (why === 'lost') return 'Live updates stopped: the connection kept dropping.';
    if (why === 'later') return 'A later step changed this ' + w + '.';
    return 'Live updates are off for this ' + w + '.';
  }
  return { subjectOf: subjectOf, pictureOf: pictureOf, fitOf: fitOf, zoomAt: zoomAt, hitTest: hitTest, elementLink: elementLink, num: num,
    pagerOf: pagerOf, changeOf: changeOf, retryAfter: retryAfter, stopWords: stopWords, LIVE: LIVE };
})();
`;

// The host wiring every view shares, inside the page's closure: the JSON-RPC calls, the theme, links, and the tool
// result handed to the view's own `onResult`. `start()` runs last, once the view has defined its parts.
const HOST = String.raw`
  var $ = function (id) { return document.getElementById(id); };
  var note = $('note'), nextId = 1, pending = {};
  function post(msg) { window.parent.postMessage(msg, '*'); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: '2.0', id: id, method: method, params: params });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { post({ jsonrpc: '2.0', method: method, params: params }); }
  function say(text) { note.textContent = text; note.hidden = !text; }
  // Why a call through the host failed, for the note: the host's own refusal (its code and words), the tool's error
  // text, or an answer with no drawing in it. A view that only said "could not be shown" left nobody able to tell a
  // host that refuses the view's calls from a tool that failed.
  function drawn(res, ok) {
    if (res && res.isError) {
      var c = res.content && res.content[0];
      throw new Error(c && c.text ? c.text : 'the tool answered an error');
    }
    if (!res || !res.structuredContent || !ok(res.structuredContent)) throw new Error('the answer held no drawing');
    return res.structuredContent;
  }
  function why(err) {
    var text = err && err.message ? String(err.message) : '';
    if (err && typeof err.code === 'number') text = 'host ' + err.code + (text ? ': ' + text : '');
    return text ? ' (' + text.slice(0, 160) + ')' : '';
  }
  function theme(ctx) {
    if (ctx && (ctx.theme === 'dark' || ctx.theme === 'light')) document.documentElement.dataset.theme = ctx.theme;
  }
  function open(url) { request('ui/open-link', { url: url }).catch(function () { window.open(url, '_blank', 'noopener'); }); }
  // The view's own tool, its file named by the product's id key (documentId, designId, projectId).
  function viewArgs(documentId, extra) {
    var args = {};
    args[ID_KEY] = documentId;
    for (var k in extra) if (extra[k] || extra[k] === 0) args[k] = extra[k];
    return args;
  }
  function start(onResult) {
    window.addEventListener('message', function (event) {
      var m = event.data;
      if (!m || m.jsonrpc !== '2.0') return;
      if (m.id !== undefined && pending[m.id] && (m.result !== undefined || m.error !== undefined)) {
        var p = pending[m.id]; delete pending[m.id];
        if (m.error) p.reject(m.error); else p.resolve(m.result);
        return;
      }
      if (m.method === 'ui/notifications/tool-result') {
        var found = LDV.subjectOf(m.params && m.params.structuredContent ? m.params : m.params && m.params.result);
        if (found) onResult(found); else say('Nothing to show for this result.');
      } else if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
    });
    request('ui/initialize', {
      protocolVersion: '2026-01-26',
      appInfo: { name: APP + '-view', version: '1' },
      appCapabilities: {}
    }).then(function (res) {
      theme(res && res.hostContext);
      notify('ui/notifications/initialized', {});
      notify('ui/notifications/size-changed', { width: document.body.scrollWidth, height: 460 });
    }).catch(function () { say(FAILED_START); });
  }
`;

// The canvas view: one tab (or one page of it) drawn as an image, panned and zoomed, an element clicked through.
const CANVAS = String.raw`
  var stage = $('stage'), img = $('art'), ring = $('ring'), tabsEl = $('tabs'), pagerEl = $('pager');
  var view = { scale: 1, x: 0, y: 0 }, tab = null, subject = null;
  // The step this view was opened by ("One live view"): its tab, the tab's revision then and the result's picture.
  var born = null;
  var dragging = null, pointers = {}, pinch = null, moved = false;
  // The edit parts, when the page has them (EDIT below): null on a read-only page.
  var ED = null;

  function apply() {
    img.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    $('zoom').textContent = Math.round(view.scale * 100) + '%';
    if (ED) ED.place();
  }
  function pointAt(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function hitAt(e) { var p = pointAt(e); return tab && LDV.hitTest(view, tab.viewBox, tab.elements, p[0], p[1]); }
  function fit() {
    if (!tab) return;
    var r = stage.getBoundingClientRect();
    view = LDV.fitOf(tab.viewBox.width, tab.viewBox.height, r.width, r.height);
    apply();
  }

  function drawTabs() {
    tabsEl.textContent = '';
    if (!tab || tab.tabs.length < 2) { tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    tab.tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.name;
      b.title = 'Show ' + t.name;
      b.setAttribute('aria-pressed', String(t.id === tab.tabId));
      b.onclick = function () { if (t.id !== tab.tabId) load(subject.documentId, t.id); };
      tabsEl.appendChild(b);
    });
  }
  // The pager: shown only for a tab of two pages or more.
  var pager = null;
  function drawPager() {
    pager = tab ? LDV.pagerOf(tab.pages, tab.pageId) : null;
    pagerEl.hidden = !pager;
    if (!pager) return;
    $('page').textContent = pager.label;
    $('page').title = pager.name;
    $('prev').disabled = !pager.prev;
    $('next').disabled = !pager.next;
  }
  function flip(pageId) { if (pageId && tab) load(subject.documentId, tab.tabId, false, pageId); }

  // Draws a tab; quiet (a live redraw) keeps the pan and zoom, says nothing, and drops a stale answer. A first draw
  // and a catch-up (check) of the step's own tab ask whether an agent's later change landed on it since (rev), and
  // say whether the view holds the step's picture (held), so the server need not draw one it would not show.
  function load(documentId, tabId, quiet, pageId, check) {
    if (!quiet) { subject = { documentId: documentId, tabId: tabId }; say('Loading…'); }
    var asks = born && LDV.num(born.rev) && born.tabId === tabId && (!quiet || check);
    var args = viewArgs(documentId, { tabId: tabId, pageId: pageId || (quiet && tab ? tab.pageId : null),
      rev: asks ? born.rev : null, held: asks && !quiet && !!born.picture });
    request('tools/call', { name: 'view_tab', arguments: args }).then(function (res) {
      show(drawn(res, function (s) { return typeof s.svg === 'string'; }), quiet, documentId);
    }).catch(function (err) {
      if (quiet) return;
      tab = null; say('This tab could not be shown. The picture in the chat still holds it.' + why(err));
    });
  }

  // Draws an answer of view_tab (or view_edit, the same shape); a quiet one drops a stale answer. After a later step
  // ("One live view") a view already drawn keeps its picture, and one opened again shows the picture its own result
  // came with (own: the answer holds no drawing, so no boxes to click, no other tab or page), or with none to show,
  // the tab as it is now, as a snapshot.
  function show(s, quiet, documentId) {
    if (quiet && (subject.documentId !== documentId || subject.tabId !== s.tabId)) return;
    if (s.superseded && quiet) return stop('later');
    var own = !!s.superseded && !s.svg;
    // The view's own edit is its step now.
    if (s.changesetId && born && born.tabId === s.tabId && LDV.num(s.rev)) born.rev = s.rev;
    tab = s;
    subject.tabId = s.tabId;
    lastDraw = Date.now();
    img.onload = function () {
      if (own) { s.viewBox.width = img.naturalWidth; s.viewBox.height = img.naturalHeight; }
      if (!quiet) fit();
      say('');
    };
    img.src = own ? born.picture : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg);
    img.alt = s.name;
    $('title').textContent = s.name;
    drawTabs();
    drawPager();
    if (ED) ED.drawn();
    if (s.superseded) stop('later', own); else if (LIVE_ON) follow(documentId);
  }
  // A live redraw: the shown tab (or page) drawn again, quietly; check asks whether a later step landed meanwhile.
  function quietLoad(check) { if (subject && tab) load(subject.documentId, subject.tabId, true, null, check); }
`;

// Live updates, shared by every view (the canvas and the board): the room tells the view a change landed, and the view
// draws again through its own `quietLoad`. The socket never sends a frame. The view sets `subject`, `lastDraw` and `ED`
// (null where it has no edit parts) and calls `follow` once drawn.
const LIVE = String.raw`
  var lastDraw = 0, liveEl = $('live'), live = { doc: null, off: true }, later = false;
  function mark(state, title) {
    liveEl.hidden = false;
    liveEl.dataset.state = state;
    liveEl.textContent = state === 'live' ? 'Live' : state === 'wait' ? 'Reconnecting' : state === 'step' ? 'Earlier step' : 'Snapshot';
    liveEl.title = title;
  }
  function drop() {
    clearTimeout(live.timer); clearTimeout(live.renew); clearTimeout(live.redraw); live.redraw = 0;
    if (live.ws) { live.ws.onclose = null; try { live.ws.close(1000); } catch (e) { /* already closed */ } live.ws = null; }
  }
  // kept: true when the view shows the picture its own step left, false when it shows the tab as it is now (a
  // snapshot, not a step); unsaid, it keeps the last picture it drew.
  function stop(why, kept) {
    drop();
    live.off = true;
    if (why === 'later') later = true;
    // Edits stay while the socket only dropped; a refusal or the Trash ends them, as the server would.
    if (ED && why !== 'lost') ED.allow(false);
    var at = new Date(lastDraw || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mark(why === 'later' && kept !== false ? 'step' : 'off', LDV.stopWords(why, WORD) + ' Showing the ' + SHOWS + (kept ? ' as this step left it.' : ' as drawn at ' + at + '.'));
  }
  function follow(documentId) {
    if (later || live.doc === documentId) return;
    drop();
    live = { doc: documentId, off: false, ws: null, tries: 0, again: false, pending: false };
    connect();
  }
  // check: a catch-up after time away from the room, which asks whether a later step landed meanwhile.
  function redraw(check) {
    // A drag, a rename or a save in progress keeps its picture until it ends.
    if (ED && ED.busy()) { live.redraw = setTimeout(function () { live.redraw = 0; redraw(check); }, 300); return; }
    quietLoad(check);
  }
  function schedule() {
    if (live.redraw) return;
    live.redraw = setTimeout(function () { live.redraw = 0; redraw(); }, Math.max(0, lastDraw + LDV.LIVE.REDRAW_MS - Date.now()));
  }
  function lost() {
    live.again = true;
    var wait = LDV.retryAfter(live.tries++);
    if (wait < 0) return stop('lost');
    mark('wait', 'Reconnecting to the ' + WORD + '…');
    live.timer = setTimeout(connect, wait);
  }
  function connect() {
    var doc = live.doc;
    if (live.off || live.pending || document.hidden) return;
    live.pending = true;
    request('tools/call', { name: 'view_live', arguments: viewArgs(doc, {}) }).then(function (res) {
      if (live.doc !== doc || live.off) return;
      live.pending = false;
      var s = res && res.structuredContent;
      if (!s || res.isError || typeof s.ticket !== 'string' || typeof s.url !== 'string') return stop('refused');
      if (ED) ED.allow(s.canEdit === true);
      if (document.hidden) { live.again = true; return; }
      var ws;
      try { ws = new WebSocket(s.url + '?t=' + encodeURIComponent(s.ticket)); } catch (e) { return stop('refused'); }
      live.ws = ws;
      ws.onopen = function () {
        live.tries = 0;
        mark('live', 'Live: this view follows the ' + WORD + ' as people change it.');
        if (live.again) redraw(true);
        live.again = false;
        live.renew = setTimeout(function () { live.again = true; drop(); connect(); },
          Math.max(0, (s.expiresAt || 0) - Date.now() - LDV.LIVE.RENEW_BEFORE_MS));
      };
      ws.onmessage = function (e) {
        var frame;
        try { frame = JSON.parse(e.data); } catch (x) { return; }
        var step = LDV.changeOf(frame, subject && subject.tabId, ED && ED.own);
        if (step === 'trashed') stop('trashed'); else if (step === 'later' && SHOWS === 'tab') stop('later'); else if (step) schedule();
      };
      ws.onclose = function (e) {
        live.ws = null;
        clearTimeout(live.renew);
        // 4004: moved to the Trash; 4010: archived from anywhere (one-explorer.md "Archived from elsewhere while open").
        if (e.code === 4004) stop('trashed'); else if (e.code === 4010) stop('archived'); else lost();
      };
    }, function () { if (live.doc === doc && !live.off) { live.pending = false; stop('refused'); } });
  }
  // A frame out of sight holds nothing in the room; shown again, it reconnects and catches up.
  document.addEventListener('visibilitychange', function () {
    if (!live.doc || live.off) return;
    if (document.hidden) { drop(); live.again = true; }
    else if (!live.ws) connect();
  });
`;

// The canvas view's input: wheel and pinch zoom, drag to pan, a click through to the editor, and the keyboard.
const CANVAS_INPUT = String.raw`
  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = stage.getBoundingClientRect();
    view = LDV.zoomAt(view, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    apply();
  }, { passive: false });
  stage.addEventListener('pointerdown', function (e) {
    if (ED && ED.owns(e)) return;
    stage.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), view: view };
      dragging = null;
      if (ED) ED.cancel();
    } else if (!(ED && ED.grab(e, hitAt(e)))) { dragging = { x: e.clientX, y: e.clientY, view: view }; moved = false; }
  });
  stage.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        view = LDV.zoomAt(pinch.view, Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        apply();
      }
      return;
    }
    if (ED && ED.drag(e)) { ring.hidden = true; return; }
    if (dragging) {
      var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      view = { scale: dragging.view.scale, x: dragging.view.x + dx, y: dragging.view.y + dy };
      apply();
      ring.hidden = true;
      return;
    }
    var hit = hitAt(e), editing = ED && ED.on();
    if (editing && hit && (hit.id === ED.picked() || ED.busy())) hit = null;
    ring.hidden = !hit;
    stage.style.cursor = hit ? (editing && hit.canMove ? 'move' : 'pointer') : 'grab';
    if (hit) {
      ring.style.left = view.x + (hit.x - tab.viewBox.x) * view.scale + 'px';
      ring.style.top = view.y + (hit.y - tab.viewBox.y) * view.scale + 'px';
      ring.style.width = hit.width * view.scale + 'px';
      ring.style.height = hit.height * view.scale + 'px';
      ring.title = (editing ? 'Select ' : 'Open ') + (hit.label || hit.ref) + (editing ? '' : ' in the editor');
    }
  });
  function release(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (ED && ED.drop(e)) { dragging = null; return; }
    if (dragging && !moved && tab) {
      var hit = hitAt(e);
      // Editing, a click selects (or clears the selection); otherwise it opens the element in the editor.
      if (ED && ED.on()) ED.select(hit || null);
      else if (hit) open(LDV.elementLink(tab.url, tab.tabId, hit.id));
    }
    dragging = null;
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', function (e) { moved = true; release(e); });
  stage.addEventListener('pointerleave', function () { ring.hidden = true; });
  stage.addEventListener('keydown', function (e) {
    if (ED && ED.key(e)) return;
    var step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (step) { view = { scale: view.scale, x: view.x + step[0], y: view.y + step[1] }; apply(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === '0') fit();
    else if (pager && (e.key === 'PageDown' || e.key === 'PageUp')) { flip(e.key === 'PageDown' ? pager.next : pager.prev); e.preventDefault(); }
  });
  function zoomBy(f) { var r = stage.getBoundingClientRect(); view = LDV.zoomAt(view, f, r.width / 2, r.height / 2); apply(); }
  $('in').onclick = function () { zoomBy(1.25); };
  $('out').onclick = function () { zoomBy(0.8); };
  $('fit').onclick = fit;
  $('prev').onclick = function () { if (pager) flip(pager.prev); };
  $('next').onclick = function () { if (pager) flip(pager.next); };
  $('open').onclick = function () { if (tab) open(LDV.elementLink(tab.url, tab.tabId, null)); };
  window.addEventListener('resize', fit);
`;

const CANVAS_START = String.raw`
  start(function (found) { born = found; load(found.documentId, found.tabId); });
`;

/** How a product's view is put together: the id key its tools take, and whether it follows the room live. */
export type ViewerScriptOptions = {
  // The argument naming the file in view_tab and view_live: documentId (the default), designId, projectId.
  idKey?: string;
  // Follow the room once drawn (view_live): every product's api mints a view-only ticket. Default true.
  live?: boolean;
  // The edit parts ("Edits in the view"): livediagram's, offered only when view_live says the token may. Default false.
  edits?: boolean;
  // The product's word for its file, in the live mark's titles: document (the default), design, plan.
  word?: string;
};

// The page's constants, as the script reads them: the app's name, its id key, whether it follows live, what it says
// when the host never starts it, its word for its file and what it shows (a tab, a board). JSON-quoted, so a name
// never breaks out of its string.
function constants(
  app: string,
  idKey: string,
  live: boolean,
  failedStart: string,
  word: string,
  shows: string,
): string {
  return (
    `var APP = ${JSON.stringify(app)}, ID_KEY = ${JSON.stringify(idKey)}, LIVE_ON = ${live}, ` +
    `FAILED_START = ${JSON.stringify(failedStart)}, WORD = ${JSON.stringify(word)}, ` +
    `SHOWS = ${JSON.stringify(shows)};`
  );
}

// The script as the page ships it: no indentation, no blank lines and no comment lines, which every host downloads and
// no frame reads. Safe because the script holds no multi-line string and no line that starts inside one.
export function compactScript(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .join('\n');
}

/** The whole script for a view: the pure parts, then the host wiring and the view's own inside the page's closure. */
export function joinViewerScript(view: string, consts: string, pure = ''): string {
  return compactScript(
    `${PURE}${pure}\nif (typeof window !== 'undefined') (function () {\n${consts}\n${HOST}\n${view}\n})();\n`,
  );
}

/** The canvas view's script for a product. */
export function viewerScript(app: string, opts: ViewerScriptOptions = {}): string {
  const consts = constants(
    app,
    opts.idKey ?? 'documentId',
    opts.live ?? true,
    'This chat could not start the view. The picture in the chat still holds it.',
    opts.word ?? 'document',
    'tab',
  );
  return opts.edits
    ? joinViewerScript(CANVAS + LIVE + CANVAS_INPUT + EDIT + CANVAS_START, consts, EDIT_PURE)
    : joinViewerScript(CANVAS + LIVE + CANVAS_INPUT + CANVAS_START, consts);
}

/** The board view's constants: no picture to fall back on, and live updates as the page asks. */
export function boardConstants(app: string, opts: ViewerScriptOptions = {}): string {
  return constants(
    app,
    opts.idKey ?? 'documentId',
    opts.live ?? true,
    'This chat could not start the view.',
    opts.word ?? 'document',
    'board',
  );
}

/** Live updates' wiring, for a view of its own (the board) to join after its parts. */
export const LIVE_SCRIPT = LIVE;

// livediagram's canvas script, as the tests run it.
export const VIEWER_SCRIPT = viewerScript('livediagram');
