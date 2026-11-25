(function () {
  'use strict';
  const T = window.Tangram, G = T.geometry;
  function attach(svg, { context, changed, moving, message }) {
    let pointer = null, lastTap = null, frame = 0, queued = null;
    let wheelGesture = { time: -Infinity, amount: 0, fired: false, direction: 0 };
    function point(event) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return null;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const { layout } = context();
      return { ...layout.toLogical(p.x, p.y), sx: p.x, sy: p.y };
    }
    function clamp(pose, layout, duringDrag = false) {
      const b = layout.bounds;
      return { ...pose, x: Math.max(b.minX + .1, Math.min(b.maxX - .1, pose.x)),
        y: Math.max(b.minY + .1, Math.min(duringDrag ? (layout.height - layout.ty) / layout.scale : b.maxY - .1, pose.y)) };
    }
    function snapped(pose, type) {
      const { board, layout } = context();
      const others = board.pieces.filter(p => p.zone === 'board' && p.pieceId !== pose.pieceId);
      const cssScale = layout.scale * svg.getBoundingClientRect().width / layout.width;
      return T.board.snap(pose, others, board.target, { scale: cssScale, pointerType: type,
        previous: pointer?.snap });
    }
    function hits(p, board, layout) {
      const ordered = [...board.pieces.filter(item => item.pieceId !== board.selected),
        ...board.pieces.filter(item => item.pieceId === board.selected)].reverse();
      const actual = ordered.filter(pose => G.containsPoint(G.transformPiece(T.draw.displayPose(pose, layout)), [p.x, p.y]));
      if (actual.length) return actual.map(pose => pose.pieceId);
      // Min. 44 px alan, ama yakın parçanın gerçek içi her zaman önceliklidir.
      return ordered.filter(pose => {
        const b = G.bounds(G.transformPiece(T.draw.displayPose(pose, layout)));
        const padX = Math.max(4 / layout.scale, (44 / layout.scale - b.width) / 2);
        const padY = Math.max(4 / layout.scale, (44 / layout.scale - b.height) / 2);
        return p.x >= b.minX - padX && p.x <= b.maxX + padX && p.y >= b.minY - padY && p.y <= b.maxY + padY;
      }).map(pose => pose.pieceId);
    }
    function release() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; queued = null;
      const old = pointer;
      pointer = null;
      if (old && svg.hasPointerCapture(old.id)) svg.releasePointerCapture(old.id);
      svg.classList.remove('is-dragging');
      svg.classList.remove('is-carrying');
    }
    function cancel() {
      if (!pointer) return false;
      const { board } = context();
      board?.cancel();
      release();
      changed();
      return true;
    }
    function down(event) {
      const c = context();
      if (!c.board || c.preview || event.button !== 0 || event.isPrimary === false) return;
      if (pointer?.phase === 'carry') {
        event.preventDefault();
        update(event);
        pointer.phase = 'drop';
        svg.setPointerCapture(event.pointerId);
        return;
      }
      if (pointer) return;
      const p = point(event);
      if (!p) return;
      const ids = hits(p, c.board, c.layout);
      let id = ids[0];
      if (ids.length > 1 && lastTap && event.timeStamp - lastTap.time < 700
        && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 8) {
        id = ids[(ids.indexOf(lastTap.id) + 1) % ids.length];
      }
      if (id) {
        event.preventDefault();
        c.board.select(id);
        changed();
        svg.querySelector(`[data-piece="${id}"]`)?.focus({ preventScroll: true });
        c.board.begin();
      }
      const pose = id ? T.draw.displayPose(c.board.current(), context().layout) : null;
      pointer = { id: event.pointerId, piece: id, type: event.pointerType,
        startX: event.clientX, startY: event.clientY, startPose: pose,
        dx: pose ? p.x - pose.x : 0, dy: pose ? p.y - pose.y : 0,
        dragged: false, moved: false, transformed: false, snap: null, phase: 'press', lastPoint: p };
      wheelGesture = { time: -Infinity, amount: 0, fired: false, direction: 0 };
      svg.setPointerCapture(event.pointerId);
    }
    function update(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      const c = context(), p = point(event);
      if (!p) return;
      pointer.lastPoint = p;
      const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (distance > (pointer.type === 'touch' ? 6 : 4)) pointer.moved = true;
      if (!pointer.piece || !pointer.moved) return;
      pointer.dragged = true;
      const pose = clamp({ ...pointer.startPose, zone: 'board', x: p.x - pointer.dx, y: p.y - pointer.dy }, c.layout, true);
      pointer.snap = c.layout.toScreen(pose)[1] < c.layout.separatorY ? snapped(pose, pointer.type) : null;
      const displayed = pointer.snap?.pose || pose;
      c.board.preview(displayed);
      svg.classList.add('is-dragging');
      moving(displayed, pointer.snap, p, event);
    }
    function move(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      queued = event;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (queued) update(queued); queued = null; });
    }
    function up(event) {
      if (!pointer || event.pointerId !== pointer.id || event.button !== 0) return;
      update(event);
      const c = context(), p = point(event), state = pointer;
      if (state.phase === 'press' && state.piece && state.type === 'mouse' && !state.dragged && !state.transformed) {
        // Trackpad: bir kez tıkla, düğmeyi basılı tutmadan taşı, tekrar tıkla.
        state.phase = 'carry';
        state.moved = true;
        if (svg.hasPointerCapture(state.id)) svg.releasePointerCapture(state.id);
        c.board.preview({ ...state.startPose, zone: 'board' });
        svg.classList.add('is-carrying');
        message('Parça elinde. Tıkla bırak; sağ tık veya kaydırarak döndür. Esc ile vazgeç.');
        changed();
        return;
      }
      if (state.dragged || state.transformed || state.phase === 'drop') {
        if (c.layout.toScreen(c.board.current())[1] >= c.layout.separatorY) {
          c.board.preview({ ...c.board.current(), zone: 'tray', x: 0, y: 0 });
        } else {
          const final = clamp(state.snap?.pose || c.board.current(), c.layout);
          c.board.preview(final);
        }
        c.board.commit();
        lastTap = null;
      } else if (state.piece) {
        c.board.cancel();
        lastTap = { id: state.piece, x: event.clientX, y: event.clientY, time: event.timeStamp };
      } else if (!state.moved && c.board.current()) {
        if (p.sy >= c.layout.separatorY) c.board.returnToTray();
        else {
          const pose = clamp({ ...c.board.current(), zone: 'board', x: p.x, y: p.y }, c.layout);
          c.board.place(snapped(pose, state.type).pose);
        }
      }
      release();
      changed();
    }
    function action(name) {
      const c = context();
      if (!c.board || c.preview) return;
      if (pointer?.piece && ['left', 'right', 'flip'].includes(name)) {
        if (queued) { update(queued); queued = null; }
        if (name === 'flip' && pointer.piece !== 'parallelogram') return;
        const pose = T.draw.displayPose(c.board.current(), c.layout);
        const next = { ...pose, zone: 'board',
          rotation: (pose.rotation + (name === 'left' ? 7 : name === 'right' ? 1 : 0)) % 8,
          flipped: name === 'flip' ? !pose.flipped : pose.flipped };
        c.board.preview(next);
        pointer.startPose = next;
        pointer.dx = pointer.lastPoint.x - next.x;
        pointer.dy = pointer.lastPoint.y - next.y;
        pointer.snap = null;
        pointer.transformed = true;
        // Dönüş, aynı taşıma işleminin içinde kalır; başlangıca geri dönmez.
        changed();
        return;
      }
      if (cancel() && name === 'undo') return;
      if (name === 'undo') c.board.undo();
      if (name === 'reset') c.board.reset();
      if (name === 'left') c.board.rotate(-1);
      if (name === 'right') c.board.rotate(1);
      if (name === 'flip') c.board.flip();
      if (name === 'tray') c.board.returnToTray();
      if (name === 'align' && c.board.current()?.zone === 'board') {
        const result = snapped(c.board.current(), 'mouse');
        c.board.place(result.pose);
        if (!result.snapped) message('Hizalanacak yakın bir kenar yok.');
      }
      changed();
    }
    function wheel(event) {
      const c = context();
      // Normal sayfa kaydırma ve pinch-zoom seçili bir parça yüzünden engellenmez.
      if (!pointer?.piece || c.preview || event.ctrlKey || event.metaKey) return;
      const delta = event.deltaY;
      if (!delta) return;
      event.preventDefault();
      const direction = Math.sign(delta), time = event.timeStamp;
      if (time - wheelGesture.time > 180 || direction !== wheelGesture.direction) {
        wheelGesture = { time, amount: 0, fired: false, direction };
      }
      wheelGesture.time = time;
      wheelGesture.amount += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 200 : 1);
      // Bir trackpad hareketinin momentum kuyruğu sekiz ayrı dönüş üretmesin.
      if (!wheelGesture.fired && Math.abs(wheelGesture.amount) >= 18) {
        wheelGesture.fired = true;
        action(direction > 0 ? 'right' : 'left');
      }
    }
    function contextMenu(event) {
      const c = context();
      if (!c.board || c.preview) return;
      if (!pointer?.piece) {
        const p = point(event), id = p && hits(p, c.board, c.layout)[0];
        if (!id) return;
        c.board.select(id);
      }
      event.preventDefault();
      action(event.shiftKey ? 'left' : 'right');
    }
    function key(event) {
      const c = context();
      if (!c.board || c.preview || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') { if (cancel()) event.preventDefault(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); action('undo'); return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const selectedElement = event.target.closest('[data-piece]');
      if (/^[1-7]$/.test(event.key)) {
        event.preventDefault(); cancel();
        const id = G.pieces[Number(event.key) - 1].id;
        c.board.select(id); changed();
        svg.querySelector(`[data-piece="${id}"]`)?.focus({ preventScroll: true });
      } else if ((event.key === 'Enter' || event.key === ' ') && selectedElement) {
        event.preventDefault();
        if (c.board.selected === selectedElement.dataset.piece && c.board.current().zone === 'board') action('align');
        else { cancel(); c.board.select(selectedElement.dataset.piece); changed(); }
      } else if (['q', 'e', 'f', 'Delete'].includes(event.key.toLowerCase() === 'delete' ? 'Delete' : event.key.toLowerCase())) {
        event.preventDefault();
        action(({ q: 'left', e: 'right', f: 'flip', delete: 'tray' })[event.key.toLowerCase()]);
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && c.board.current()) {
        event.preventDefault(); cancel();
        let pose = c.board.current();
        if (pose.zone === 'tray') pose = { ...pose, zone: 'board',
          x: (c.layout.bounds.minX + c.layout.bounds.maxX) / 2,
          y: (c.layout.bounds.minY + c.layout.bounds.maxY) / 2 };
        const step = event.shiftKey ? .01 : .1;
        const [dx, dy] = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] })[event.key];
        c.board.place(clamp({ ...pose, x: pose.x + dx, y: pose.y + dy }, c.layout));
        changed();
      }
    }
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', event => { if (pointer && pointer.id === event.pointerId) cancel(); });
    svg.addEventListener('lostpointercapture', event => {
      if (pointer && pointer.id === event.pointerId && pointer.phase !== 'carry') cancel();
    });
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('contextmenu', contextMenu);
    svg.addEventListener('click', event => {
      if (event.detail !== 0 || context().preview) return;
      const group = event.target.closest('[data-piece]');
      if (group) { cancel(); context().board.select(group.dataset.piece); changed(); }
    });
    document.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    return { cancel, action, carrying: () => pointer?.phase === 'carry' || pointer?.phase === 'drop' };
  }
  T.input = { attach };
})();
