// The interactive view's script (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"), as the text the page
// inlines: a plain string, never a function's source, so no bundler helper leaks into the sandboxed frame. It talks to
// the host over postMessage JSON-RPC (the io.modelcontextprotocol/ui extension): ui/initialize, then the tool's result
// arrives as ui/notifications/tool-result; the tab is read with tools/call view_tab and drawn as an <img> of its SVG,
// so nothing in the SVG runs or fetches. Once drawn, it follows the document live ("Live updates"): a view-only
// ticket from tools/call view_live opens the room's socket, which it only listens on, and a change to the shown tab
// draws it again. Its pure parts sit on `LDV` (subjectOf, fitOf, zoomAt, hitTest, elementLink, changeOf, retryAfter,
// stopWords) for the tests, which evaluate this text with no window; the wiring runs only in a page.

export const VIEWER_SCRIPT = String.raw`
var LDV = (function () {
  var MIN = 0.05, MAX = 8;
  // Live updates' numbers (the spec's LIVE_*): one redraw per REDRAW_MS at most, reconnects from MIN_MS doubling to
  // MAX_MS, MAX_ATTEMPTS tries without an open socket, and a fresh ticket RENEW_BEFORE_MS before one lapses.
  var LIVE = { REDRAW_MS: 1500, MIN_MS: 1000, MAX_MS: 30000, MAX_ATTEMPTS: 6, RENEW_BEFORE_MS: 30000 };
  // The ops that change what a tab shows, or say a change was saved (tab-saved: view_tab now reads it).
  var CONTENT = { tab: 1, el: 1, 'tab-meta': 1, 'el-delta': 1, vote: 1, qa: 1, changeset: 1, 'tab-saved': 1 };
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return typeof v === 'string' && v.length > 0 ? v : null; }
  // The document and tab a tool's result names: create (documentId, tabIds), add_tab and update (documentId, tabId),
  // read_document (id, tab.id).
  function subjectOf(result) {
    var s = result && typeof result === 'object' ? result.structuredContent : null;
    if (!s || typeof s !== 'object') return null;
    var doc = str(s.documentId) || str(s.id);
    if (!doc) return null;
    var tab = str(s.tabId) || (s.tab && str(s.tab.id)) || (Array.isArray(s.tabIds) ? str(s.tabIds[0]) : null);
    return { documentId: doc, tabId: tab };
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
  // The editor at an element (the Inbox's element deep link), or at the tab.
  function elementLink(url, tabId, elementId) {
    var hash = 't=' + encodeURIComponent(tabId);
    if (elementId) hash += '&el=' + encodeURIComponent(elementId);
    return url.split('#')[0] + '#' + hash;
  }
  // What a room frame means for the shown tab: draw it again, the document went to the Trash, or nothing.
  function changeOf(frame, tabId) {
    var op = frame && frame.kind === 'op' ? frame.op : null;
    if (!op || typeof op.kind !== 'string') return null;
    if (op.kind === 'document-trashed') return 'trashed';
    if (op.kind === 'document-meta') return 'redraw';
    return CONTENT[op.kind] === 1 && (!op.tabId || op.tabId === tabId) ? 'redraw' : null;
  }
  // The wait before reconnect try number tries (from 0), or -1 once they have run out.
  function retryAfter(tries) {
    return tries >= LIVE.MAX_ATTEMPTS ? -1 : Math.min(LIVE.MAX_MS, LIVE.MIN_MS * Math.pow(2, tries));
  }
  function stopWords(why) {
    if (why === 'trashed') return 'This document moved to the Trash.';
    if (why === 'lost') return 'Live updates stopped: the connection kept dropping.';
    return 'Live updates are off for this document.';
  }
  return { subjectOf: subjectOf, fitOf: fitOf, zoomAt: zoomAt, hitTest: hitTest, elementLink: elementLink, num: num,
    changeOf: changeOf, retryAfter: retryAfter, stopWords: stopWords, LIVE: LIVE };
})();

if (typeof window !== 'undefined') (function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), img = $('art'), ring = $('ring'), tabsEl = $('tabs'), note = $('note');
  var nextId = 1, pending = {}, view = { scale: 1, x: 0, y: 0 }, tab = null, subject = null;
  var dragging = null, pointers = {}, pinch = null, moved = false, lastDraw = 0, liveEl = $('live');
  var live = { doc: null, off: true };

  function post(msg) { window.parent.postMessage(msg, '*'); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: '2.0', id: id, method: method, params: params });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { post({ jsonrpc: '2.0', method: method, params: params }); }
  function say(text) { note.textContent = text; note.hidden = !text; }
  function theme(ctx) {
    if (ctx && (ctx.theme === 'dark' || ctx.theme === 'light')) document.documentElement.dataset.theme = ctx.theme;
  }
  function apply() {
    img.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    $('zoom').textContent = Math.round(view.scale * 100) + '%';
  }
  function fit() {
    if (!tab) return;
    var r = stage.getBoundingClientRect();
    view = LDV.fitOf(tab.viewBox.width, tab.viewBox.height, r.width, r.height);
    apply();
  }
  function open(url) { request('ui/open-link', { url: url }).catch(function () { window.open(url, '_blank', 'noopener'); }); }

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

  // Draws a tab; quiet (a live redraw) keeps the pan and zoom, says nothing, and drops a stale answer.
  function load(documentId, tabId, quiet) {
    if (!quiet) { subject = { documentId: documentId, tabId: tabId }; say('Loading…'); }
    var args = { documentId: documentId };
    if (tabId) args.tabId = tabId;
    request('tools/call', { name: 'view_tab', arguments: args }).then(function (res) {
      var s = res && res.structuredContent;
      if (!s || res.isError || typeof s.svg !== 'string') throw new Error('no view');
      if (quiet && (subject.documentId !== documentId || subject.tabId !== s.tabId)) return;
      tab = s;
      subject.tabId = s.tabId;
      lastDraw = Date.now();
      img.onload = function () { if (!quiet) fit(); say(''); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg);
      img.alt = s.name;
      $('title').textContent = s.name;
      drawTabs();
      follow(documentId);
    }).catch(function () {
      if (quiet) return;
      tab = null; say('This tab could not be shown. The picture in the chat still holds it.');
    });
  }

  // Live updates: the room tells the view a change landed; view_tab draws it. The socket never sends a frame.
  function mark(state, title) {
    liveEl.hidden = false;
    liveEl.dataset.state = state;
    liveEl.textContent = state === 'live' ? 'Live' : state === 'wait' ? 'Reconnecting' : 'Snapshot';
    liveEl.title = title;
  }
  function drop() {
    clearTimeout(live.timer); clearTimeout(live.renew); clearTimeout(live.redraw); live.redraw = 0;
    if (live.ws) { live.ws.onclose = null; try { live.ws.close(1000); } catch (e) { /* already closed */ } live.ws = null; }
  }
  function stop(why) {
    drop();
    live.off = true;
    var at = new Date(lastDraw || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mark('off', LDV.stopWords(why) + ' Showing the tab as drawn at ' + at + '.');
  }
  function follow(documentId) {
    if (live.doc === documentId) return;
    drop();
    live = { doc: documentId, off: false, ws: null, tries: 0, again: false, pending: false };
    connect();
  }
  function redraw() { if (subject && tab) load(subject.documentId, subject.tabId, true); }
  function schedule() {
    if (live.redraw) return;
    live.redraw = setTimeout(function () { live.redraw = 0; redraw(); }, Math.max(0, lastDraw + LDV.LIVE.REDRAW_MS - Date.now()));
  }
  function lost() {
    live.again = true;
    var wait = LDV.retryAfter(live.tries++);
    if (wait < 0) return stop('lost');
    mark('wait', 'Reconnecting to the document…');
    live.timer = setTimeout(connect, wait);
  }
  function connect() {
    var doc = live.doc;
    if (live.off || live.pending || document.hidden) return;
    live.pending = true;
    request('tools/call', { name: 'view_live', arguments: { documentId: doc } }).then(function (res) {
      if (live.doc !== doc || live.off) return;
      live.pending = false;
      var s = res && res.structuredContent;
      if (!s || res.isError || typeof s.ticket !== 'string' || typeof s.url !== 'string') return stop('refused');
      if (document.hidden) { live.again = true; return; }
      var ws;
      try { ws = new WebSocket(s.url + '?t=' + encodeURIComponent(s.ticket)); } catch (e) { return stop('refused'); }
      live.ws = ws;
      ws.onopen = function () {
        live.tries = 0;
        mark('live', 'Live: this view follows the document as people change it.');
        if (live.again) redraw();
        live.again = false;
        live.renew = setTimeout(function () { live.again = true; drop(); connect(); },
          Math.max(0, (s.expiresAt || 0) - Date.now() - LDV.LIVE.RENEW_BEFORE_MS));
      };
      ws.onmessage = function (e) {
        var frame;
        try { frame = JSON.parse(e.data); } catch (x) { return; }
        var step = LDV.changeOf(frame, subject && subject.tabId);
        if (step === 'trashed') stop('trashed'); else if (step === 'redraw') schedule();
      };
      ws.onclose = function (e) {
        live.ws = null;
        clearTimeout(live.renew);
        if (e.code === 4004) stop('trashed'); else lost();
      };
    }, function () { if (live.doc === doc && !live.off) { live.pending = false; stop('refused'); } });
  }
  // A frame out of sight holds nothing in the room; shown again, it reconnects and catches up.
  document.addEventListener('visibilitychange', function () {
    if (!live.doc || live.off) return;
    if (document.hidden) { drop(); live.again = true; }
    else if (!live.ws) connect();
  });

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
      if (found) load(found.documentId, found.tabId); else say('Nothing to show for this result.');
    } else if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
  });

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = stage.getBoundingClientRect();
    view = LDV.zoomAt(view, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    apply();
  }, { passive: false });
  stage.addEventListener('pointerdown', function (e) {
    stage.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), view: view };
      dragging = null;
    } else { dragging = { x: e.clientX, y: e.clientY, view: view }; moved = false; }
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
    if (dragging) {
      var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      view = { scale: dragging.view.scale, x: dragging.view.x + dx, y: dragging.view.y + dy };
      apply();
      ring.hidden = true;
      return;
    }
    var hit = tab && LDV.hitTest(view, tab.viewBox, tab.elements, e.clientX - r.left, e.clientY - r.top);
    ring.hidden = !hit;
    stage.style.cursor = hit ? 'pointer' : 'grab';
    if (hit) {
      ring.style.left = view.x + (hit.x - tab.viewBox.x) * view.scale + 'px';
      ring.style.top = view.y + (hit.y - tab.viewBox.y) * view.scale + 'px';
      ring.style.width = hit.width * view.scale + 'px';
      ring.style.height = hit.height * view.scale + 'px';
      ring.title = 'Open ' + (hit.label || hit.ref) + ' in the editor';
    }
  });
  function release(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (dragging && !moved && tab) {
      var r = stage.getBoundingClientRect();
      var hit = LDV.hitTest(view, tab.viewBox, tab.elements, e.clientX - r.left, e.clientY - r.top);
      if (hit) open(LDV.elementLink(tab.url, tab.tabId, hit.id));
    }
    dragging = null;
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', function (e) { moved = true; release(e); });
  stage.addEventListener('pointerleave', function () { ring.hidden = true; });
  stage.addEventListener('keydown', function (e) {
    var step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (step) { view = { scale: view.scale, x: view.x + step[0], y: view.y + step[1] }; apply(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === '0') fit();
  });
  function zoomBy(f) { var r = stage.getBoundingClientRect(); view = LDV.zoomAt(view, f, r.width / 2, r.height / 2); apply(); }
  $('in').onclick = function () { zoomBy(1.25); };
  $('out').onclick = function () { zoomBy(0.8); };
  $('fit').onclick = fit;
  $('open').onclick = function () { if (tab) open(LDV.elementLink(tab.url, tab.tabId, null)); };
  window.addEventListener('resize', fit);

  request('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: '__APP__-view', version: '1' },
    appCapabilities: {}
  }).then(function (res) {
    theme(res && res.hostContext);
    notify('ui/notifications/initialized', {});
    notify('ui/notifications/size-changed', { width: document.body.scrollWidth, height: 460 });
  }).catch(function () { say('This chat could not start the view. The picture in the chat still holds it.'); });
})();
`;
