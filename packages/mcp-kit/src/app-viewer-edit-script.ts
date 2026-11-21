// The edit parts of the interactive view's script (docs/specs/015-api/mcp-server.md "Edits in the view"), as the text
// app-viewer-script.ts joins into a page built with edits (livediagram's): their pure parts, set on `LDV` beside the
// rest, and the wiring, which runs inside the page's closure after the canvas view's own parts (it reads `stage`,
// `tab`, `view`, `request`, `say` and the rest from there). Plain strings, never a function's source.

// The edit parts' pure parts ("Edits in the view"), on LDV beside the rest, only on a page that edits.
export const EDIT_PURE = String.raw`
LDV.NUDGE_SETTLE_MS = 400;
LDV.OWN_MAX = 16;
// An arrow key's nudge in the tab's pixels (Shift for one), or null for any other key.
LDV.nudgeOf = function (key, fine) {
  var d = fine ? 1 : 10;
  return { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[key] || null;
};
// A drag of (dx, dy) screen pixels at scale, in the tab's whole pixels.
LDV.moveOf = function (dx, dy, scale) { return [Math.round(dx / scale) || 0, Math.round(dy / scale) || 0]; };
// The element Tab (or Shift+Tab, back) selects after the one with id, or -1 past either end, so focus leaves.
LDV.stepOf = function (elements, id, back) {
  var at = -1;
  for (var i = 0; i < elements.length; i++) if (elements[i].id === id) at = i;
  var next = at < 0 ? (back ? elements.length - 1 : 0) : at + (back ? -1 : 1);
  return next >= 0 && next < elements.length ? next : -1;
};
// What the selection bar says an element allows beside its buttons.
LDV.hintOf = function (el) {
  if (!el.canMove && !el.canRename) return 'Locked';
  return el.canMove ? 'Drag to move' : 'Move it in the editor';
};
`;

// The edit parts of the canvas view ("Edits in the view"), on a page built with edits: the Edit toggle (shown once
// view_live says the token may), the selection and its bar, the rename box, drag and nudge moves, and the one
// tools/call view_edit per finished gesture, whose answer is the tab drawn again. The server decides every write.
export const EDIT = String.raw`
  ED = (function () {
    var btn = $('edit'), sel = $('sel'), bar = $('bar'), box = $('name-box'), sr = $('sr');
    var allowed = false, editing = false, picked = null, grab = null, naming = false, saving = false;
    // The move a drag or a nudge holds, drawn on its element (moving) until the save answers.
    var shift = [0, 0], moving = null, settle = 0, own = [], saved = 0;
    // What the bar says of a save in place of its hint: Saving…, then Saved for a moment.
    var status = '';
    var VIEW_LABEL = stage.getAttribute('aria-label');
    function find(id) {
      for (var i = 0; tab && id && i < tab.elements.length; i++) if (tab.elements[i].id === id) return tab.elements[i];
      return null;
    }
    function current() { return find(picked); }
    function nameOf(el) { return el.label || el.ref; }
    function allow(yes) {
      allowed = yes;
      btn.hidden = !yes;
      if (!yes && editing) turn(false);
    }
    function turn(on) {
      editing = on && allowed;
      btn.setAttribute('aria-pressed', String(editing));
      btn.title = editing ? 'Stop editing' : 'Rename and move elements in this view';
      stage.setAttribute('aria-label', editing
        ? 'The tab, editing: click an element to select it, drag it to move it, double-click to rename it'
        : VIEW_LABEL);
      if (!editing) select(null);
    }
    // The element's box in the stage's pixels, moved by the shift a drag or a nudge holds on it.
    function rectOf(el) {
      var d = el.id === moving ? shift : [0, 0];
      return {
        l: view.x + (el.x + d[0] - tab.viewBox.x) * view.scale,
        t: view.y + (el.y + d[1] - tab.viewBox.y) * view.scale,
        w: el.width * view.scale,
        h: el.height * view.scale
      };
    }
    function place() {
      var el = current();
      sel.hidden = !el;
      // The bar steps aside while a drag is out, and for the rename box.
      bar.hidden = !el || naming || !!(grab && grab.moved);
      if (!el) return;
      var r = rectOf(el), W = stage.clientWidth, H = stage.clientHeight;
      sel.style.cssText = 'left:' + r.l + 'px;top:' + r.t + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
      sel.classList.toggle('drag', el.id === moving && (shift[0] !== 0 || shift[1] !== 0));
      if (naming) {
        var w = Math.min(Math.max(r.w, 180), W - 16);
        box.style.cssText = 'left:' + Math.min(Math.max(8, r.l + r.w / 2 - w / 2), W - w - 8) + 'px;top:' +
          Math.min(Math.max(8, r.t + r.h / 2 - 17), H - 42) + 'px;width:' + w + 'px';
        return;
      }
      var bw = bar.offsetWidth, bh = bar.offsetHeight;
      var top = r.t - bh - 8 >= 8 ? r.t - bh - 8 : Math.min(r.t + r.h + 8, H - bh - 8);
      bar.style.left = Math.min(Math.max(8, r.l + r.w / 2 - bw / 2), Math.max(8, W - bw - 8)) + 'px';
      bar.style.top = Math.max(8, top) + 'px';
    }
    // The bar's words and buttons for the selected element.
    function fill(el) {
      $('bar-name').textContent = nameOf(el);
      bar.setAttribute('aria-label', nameOf(el));
      $('ren').disabled = !el.canRename;
      $('ren').title = el.canRename ? 'Rename (Enter)' : el.canMove ? 'Only shapes, text and stickies are renamed here' : 'Locked: unlock it in the editor to rename it';
      $('hint').textContent = status || LDV.hintOf(el);
    }
    function refresh() { var el = current(); if (el) { fill(el); place(); } }
    function select(hit) {
      if (naming) commitName(false);
      if (settle) flush();
      // A word about the last save belongs to the element it was about.
      if (!saving && (hit ? hit.id : null) !== picked) { status = ''; clearTimeout(saved); }
      picked = hit ? hit.id : null;
      var el = current();
      if (el) {
        fill(el);
        sr.textContent = 'Selected ' + nameOf(el) + '. ' +
          (el.canRename ? 'Enter to rename. ' : '') + (el.canMove ? 'Arrow keys to move.' : LDV.hintOf(el) + '.');
      } else sr.textContent = '';
      place();
    }
    function startName() {
      var el = current();
      if (!el || !el.canRename || saving) return;
      naming = true;
      box.value = el.label || '';
      box.hidden = false;
      place();
      box.focus();
      box.select();
    }
    function commitName(keep) {
      var el = current();
      naming = false;
      box.hidden = true;
      var next = box.value.trim();
      if (keep && el && next !== (el.label || '')) send([{ elementId: el.id, label: next }]);
      place();
      stage.focus();
    }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitName(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commitName(false); }
    });
    box.addEventListener('blur', function () { if (naming) commitName(true); });
    // One view_edit for a finished gesture; its answer is the tab drawn again.
    function send(edits) {
      var doc = subject.documentId, tabId = tab.tabId;
      saving = true;
      clearTimeout(saved);
      status = 'Saving…';
      refresh();
      request('tools/call', { name: 'view_edit', arguments: viewArgs(doc, { tabId: tabId, edits: edits }) })
        .then(function (res) {
          var s = res && res.structuredContent;
          if (!s || res.isError || typeof s.svg !== 'string') {
            var why = res && res.content && res.content[0] && res.content[0].text;
            throw new Error(why || 'refused');
          }
          if (s.changesetId) { own.push(s.changesetId); if (own.length > LDV.OWN_MAX) own.shift(); }
          done('Saved');
          show(s, true, doc);
        })
        .catch(function (err) {
          done('');
          say('The edit was not saved' + (err && err.message && err.message !== 'refused' ? ': ' + err.message : '.'));
          setTimeout(function () { say(''); }, 5000);
          if (subject && tab) load(subject.documentId, subject.tabId, true);
        });
    }
    function done(word) {
      saving = false;
      shift = [0, 0];
      moving = null;
      status = word;
      if (word) {
        sr.textContent = word + '.';
        saved = setTimeout(function () { status = ''; refresh(); }, 1500);
      }
      refresh();
      place();
    }
    function flush() {
      clearTimeout(settle);
      settle = 0;
      var el = find(moving);
      if (el && (shift[0] || shift[1])) send([{ elementId: el.id, dx: shift[0], dy: shift[1] }]);
      else { shift = [0, 0]; moving = null; }
    }
    function grabAt(e, hit) {
      if (!editing || !hit || saving || naming || !hit.canMove) return false;
      if (hit.id !== picked) select(hit);
      grab = { x: e.clientX, y: e.clientY, moved: false };
      return true;
    }
    function dragTo(e) {
      if (!grab) return false;
      var dx = e.clientX - grab.x, dy = e.clientY - grab.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) grab.moved = true;
      if (grab.moved) { moving = picked; shift = LDV.moveOf(dx, dy, view.scale); place(); }
      return true;
    }
    function dropAt() {
      if (!grab) return false;
      var g = grab;
      grab = null;
      if (g.moved && (shift[0] || shift[1])) flush(); else { shift = [0, 0]; moving = null; place(); }
      return true;
    }
    function key(e) {
      if (e.target === box) return true;
      // The bar's own buttons take their keys; Escape from them clears the selection.
      if (bar.contains(e.target)) {
        if (e.key === 'Escape') { select(null); stage.focus(); }
        return true;
      }
      if (!editing) return false;
      var el = current();
      if (e.key === 'Escape') { if (el) select(null); else turn(false); return true; }
      if (e.key === 'Tab' && tab) {
        var i = LDV.stepOf(tab.elements, picked, e.shiftKey);
        if (i < 0) { select(null); return true; }
        select(tab.elements[i]);
        e.preventDefault();
        return true;
      }
      if (!el) return false;
      if (e.key === 'Enter' || e.key === 'F2') { startName(); e.preventDefault(); return true; }
      var d = LDV.nudgeOf(e.key, e.shiftKey);
      if (!d) return false;
      e.preventDefault();
      if (!el.canMove || saving) return true;
      if (moving !== el.id) { moving = el.id; shift = [0, 0]; }
      shift = [shift[0] + d[0], shift[1] + d[1]];
      place();
      clearTimeout(settle);
      settle = setTimeout(flush, LDV.NUDGE_SETTLE_MS);
      return true;
    }
    btn.onclick = function () { turn(!editing); };
    $('ren').onclick = startName;
    $('go').onclick = function () { if (tab && picked) open(LDV.elementLink(tab.url, tab.tabId, picked)); };
    stage.addEventListener('dblclick', function (e) {
      var hit = editing && hitAt(e);
      if (!hit) return;
      select(hit);
      startName();
    });
    return {
      own: own,
      on: function () { return editing; },
      picked: function () { return picked; },
      busy: function () { return !!(grab || naming || saving || settle); },
      allow: allow,
      place: place,
      select: select,
      grab: grabAt,
      drag: dragTo,
      drop: dropAt,
      key: key,
      // A press in the rename box or on the bar is theirs, not a pan or a pick; one elsewhere saves a name first.
      owns: function (e) { return e.target === box || bar.contains(e.target); },
      cancel: function () { grab = null; shift = [0, 0]; moving = null; place(); },
      // A redraw: the selection follows its element, quietly, or clears when it is gone or the tab changed.
      drawn: function () {
        var el = current();
        if (picked && !el) select(null);
        else if (el) { fill(el); place(); }
      }
    };
  })();
`;
