// Phase 1 only: a visual fixture viewer, deliberately without a game engine.
(function () {
  'use strict';

  const { previewFixtures: fixtures, draw } = window.Kakuro;
  const byId = id => document.getElementById(id);
  const board = byId('board'), viewport = byId('board-viewport');
  let fixture = fixtures.small;
  let showExample = false;
  let selected = fixture.selected;
  let direction = 'across';
  let groups = [];
  let membership = new Map();

  function fixtureGroups() {
    groups = [];
    membership = new Map();
    fixture.cells.forEach((cell, index) => {
      for (const axis of ['across', 'down']) {
        if (!cell[axis]) continue;
        const members = [], step = axis === 'across' ? 1 : fixture.cols;
        let cursor = index + step;
        while (cursor < fixture.cells.length && fixture.cells[cursor].type === 'white' &&
          (axis !== 'across' || Math.floor(cursor / fixture.cols) === Math.floor(index / fixture.cols))) {
          members.push(cursor);
          cursor += step;
        }
        const group = { clue: index, axis, total: cell[axis], cells: members };
        groups.push(group);
        for (const member of members) {
          if (!membership.has(member)) membership.set(member, {});
          membership.get(member)[axis] = group;
        }
      }
    });
  }

  function cellLabel(index) {
    const row = Math.floor(index / fixture.cols) + 1, col = index % fixture.cols + 1;
    const digit = showExample && fixture.sampleValues[index];
    const notes = showExample && fixture.sampleNotes[index];
    const pair = membership.get(index);
    return `Satır ${row}, sütun ${col}. ${digit ? `Değer ${digit}` : 'Boş'}.${
      notes ? ` Notlar: ${notes.join(', ')}.` : ''
    } Yatay toplam ${pair.across.total}, dikey toplam ${pair.down.total}.`;
  }

  function makeCell(cell, index) {
    const container = document.createElement('div');
    container.className = `cell ${cell.type}`;
    container.dataset.index = index;
    container.setAttribute('role', 'gridcell');
    container.setAttribute('aria-colindex', index % fixture.cols + 1);
    if (cell.type === 'white') {
      const button = document.createElement('button');
      button.className = 'cell-button';
      button.type = 'button';
      button.dataset.index = index;
      button.tabIndex = -1;
      button.setAttribute('aria-label', cellLabel(index));
      const digit = showExample && fixture.sampleValues[index];
      const notes = showExample && fixture.sampleNotes[index];
      if (digit) draw.value(button, digit, [fixture.id, index]);
      else if (notes) {
        const list = document.createElement('span');
        list.className = 'cell-notes';
        list.setAttribute('aria-hidden', 'true');
        for (let number = 1; number <= 9; number++) {
          const slot = document.createElement('span');
          slot.textContent = notes.includes(number) ? number : '';
          list.append(slot);
        }
        button.append(list);
      }
      container.append(button);
    } else if (cell.across || cell.down) {
      const button = document.createElement('button');
      button.className = 'clue-button';
      button.type = 'button';
      button.dataset.index = index;
      // Every group can also be reached through the two keyboard-accessible
      // direction buttons for a selected white cell.
      button.tabIndex = -1;
      const labels = [];
      if (cell.across) labels.push(`Sağa ${cell.across}`);
      if (cell.down) labels.push(`Aşağı ${cell.down}`);
      button.setAttribute('aria-label', labels.join(', '));
      for (const axis of ['across', 'down']) {
        if (!cell[axis]) continue;
        const text = document.createElement('span');
        text.className = `clue-total clue-${axis}`;
        text.textContent = cell[axis];
        text.setAttribute('aria-hidden', 'true');
        button.append(text);
      }
      container.append(button);
    } else container.setAttribute('aria-label', 'Koyu kare');
    return container;
  }

  function render() {
    fixtureGroups();
    if (!membership.has(selected)) selected = membership.keys().next().value;
    board.replaceChildren();
    board.style.setProperty('--columns', fixture.cols);
    board.style.setProperty('--rows', fixture.rows);
    board.setAttribute('aria-rowcount', fixture.rows);
    board.setAttribute('aria-colcount', fixture.cols);
    for (let row = 0; row < fixture.rows; row++) {
      const line = document.createElement('div');
      line.className = 'board-row';
      line.setAttribute('role', 'row');
      line.setAttribute('aria-rowindex', row + 1);
      for (let col = 0; col < fixture.cols; col++) {
        const index = row * fixture.cols + col;
        line.append(makeCell(fixture.cells[index], index));
      }
      board.append(line);
    }
    draw.board(board, fixture);
    byId('filled-count').textContent = showExample ? Object.keys(fixture.sampleValues).length : 0;
    byId('total-count').textContent = membership.size;
    byId('difficulty').textContent = fixture.label;
    byId('timer').textContent = showExample ? '03:24' : '00:00';
    byId('timer').setAttribute('aria-label', showExample ? 'Örnek süre: 3 dakika 24 saniye' : 'Örnek süre: 0 dakika 0 saniye');
    byId('empty-view').setAttribute('aria-pressed', !showExample);
    byId('sample-view').setAttribute('aria-pressed', showExample);
    resize();
    updateSelection();
  }

  function updateSelection({ focus = false, scroll = false, announce = false } = {}) {
    const pair = membership.get(selected);
    board.querySelectorAll('.selection-ink').forEach(node => node.remove());
    board.querySelectorAll('.cell').forEach(cell => {
      const index = Number(cell.dataset.index);
      const isSelected = index === selected;
      cell.classList.toggle('selected', isSelected);
      cell.classList.toggle('crossed', pair.across.cells.includes(index) || pair.down.cells.includes(index));
      cell.classList.toggle('active-run', pair[direction].cells.includes(index));
      if (fixture.cells[index].type === 'white') {
        cell.setAttribute('aria-selected', isSelected);
        cell.firstElementChild.tabIndex = isSelected ? 0 : -1;
      }
      const clue = cell.querySelector('.clue-button');
      if (clue) {
        clue.classList.toggle('active-clue', index === pair[direction].clue);
        clue.querySelectorAll('.clue-total').forEach(total => total.classList.toggle('active-total', index === pair[direction].clue && total.classList.contains(`clue-${direction}`)));
      }
    });
    byId('across-total').textContent = pair.across.total;
    byId('down-total').textContent = pair.down.total;
    byId('across-button').setAttribute('aria-pressed', direction === 'across');
    byId('down-button').setAttribute('aria-pressed', direction === 'down');
    const button = board.querySelector(`.cell-button[data-index="${selected}"]`);
    draw.selection(button, fixture.id);
    if (focus) button.focus({ preventScroll: true });
    if (scroll) reveal(button);
    if (announce) byId('announcement').textContent = `${cellLabel(selected)} ${direction === 'across' ? 'Yatay' : 'Dikey'} grup seçili.`;
  }

  function reveal(button) {
    const cell = button.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    if (cell.left < view.left + 4) viewport.scrollLeft -= view.left + 4 - cell.left;
    else if (cell.right > view.right - 4) viewport.scrollLeft += cell.right - view.right + 4;
  }

  function resize() {
    const available = byId('board-viewport').clientWidth - 8;
    const size = Math.max(44, Math.min(104, Math.floor(available / fixture.cols)));
    board.style.setProperty('--cell-size', `${size}px`);
    byId('board').parentElement.parentElement.style.setProperty('--board-width', `${size * fixture.cols}px`);
    byId('scroll-cue').hidden = fixture.cols * size <= available;
    draw.decorate();
    const button = board.querySelector(`.cell-button[data-index="${selected}"]`);
    if (button) reveal(button);
  }

  board.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const index = Number(button.dataset.index), cell = fixture.cells[index];
    if (cell.type === 'white') selected = index;
    else {
      const rect = button.getBoundingClientRect();
      const acrossTriangle = (event.clientX - rect.left) / rect.width > (event.clientY - rect.top) / rect.height;
      direction = cell.across && (!cell.down || acrossTriangle) ? 'across' : 'down';
      const group = groups.find(g => g.clue === index && g.axis === direction);
      selected = group.cells[0];
    }
    updateSelection({ focus: true, scroll: true, announce: true });
  });

  board.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    direction = move[0] ? 'down' : 'across';
    let row = Math.floor(selected / fixture.cols) + move[0], col = selected % fixture.cols + move[1];
    while (row >= 0 && row < fixture.rows && col >= 0 && col < fixture.cols) {
      const index = row * fixture.cols + col;
      if (fixture.cells[index].type === 'white') {
        selected = index;
        break;
      }
      row += move[0];
      col += move[1];
    }
    updateSelection({ focus: true, scroll: true, announce: false });
  });

  for (const axis of ['across', 'down']) {
    byId(`${axis}-button`).addEventListener('click', () => {
      direction = axis;
      updateSelection({ announce: true });
    });
  }
  byId('empty-view').addEventListener('click', () => {
    showExample = false;
    render();
    byId('announcement').textContent = 'Boş başlangıç görünümü. Bütün beyaz kareler boş.';
  });
  byId('sample-view').addEventListener('click', () => {
    showExample = true;
    render();
    byId('announcement').textContent = 'Sayı ve kalem notları örneği. Bu tahta henüz doğrulanmış bir bulmaca değildir.';
  });
  byId('preview-size').addEventListener('change', event => {
    fixture = fixtures[event.target.value];
    selected = fixture.selected;
    direction = 'across';
    viewport.scrollLeft = 0;
    render();
    byId('announcement').textContent = `${fixture.rows} satır, ${fixture.cols} sütunlu görsel prova.`;
  });
  function toggleHelp(open) {
    byId('help-panel').hidden = !open;
    byId('help-button').setAttribute('aria-expanded', open);
    if (open) {
      draw.decorate(byId('help-panel'));
      byId('close-help').focus();
    } else byId('help-button').focus({ preventScroll: true });
  }
  byId('help-button').addEventListener('click', () => toggleHelp(byId('help-panel').hidden));
  byId('close-help').addEventListener('click', () => toggleHelp(false));
  byId('help-panel').addEventListener('keydown', event => {
    if (event.key === 'Escape') toggleHelp(false);
  });

  render();
  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resize);
  }).observe(viewport);
  document.fonts.ready.then(() => draw.decorate());
})();
