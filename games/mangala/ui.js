// Uygulama durumu motor sonucudur. Animasyon yalnız bu sonucun gösterimidir.
(function () {
  'use strict';
  const M = window.Mangala, B = M.board, Match = M.match, D = M.draw;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const board = document.querySelector('.board');
  const form = $('settings-form');
  const levels = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
  Kit.malzeme.sec('kursunkalem', { cizim: { animasyon: false } });
  Kit.ses.kur({ anahtar: 'mangala-sessiz' });
  Kit.ses.sessizYap(true); // Ses ancak bu sayfada kullanıcı açınca başlar.
  let sound = false, match, activity = 'idle', epoch = 0, controller = null;
  let hint = null, message = '', paused = false;
  const names = () => match.settings.mode === 'local' ? ['1. oyuncu', '2. oyuncu'] : ['Sen', 'Bilgisayar'];
  const humanTurn = () => match.settings.mode === 'local' || match.board.player === 0;
  const readSettings = () => {
    try { return Match.settings(JSON.parse(localStorage.getItem('mangala-ayarlar') || '{}')); }
    catch (_) { return Match.settings(); }
  };
  const saveSettings = settings => { try { localStorage.setItem('mangala-ayarlar', JSON.stringify(settings)); } catch (_) { /* depolama isteğe bağlı */ } };
  const announce = text => { $('announcement').textContent = text; };

  function cancelWork() {
    epoch++;
    controller?.abort(); controller = null;
    Kit.ses.durdur();
    activity = 'idle';
    hint = null;
  }
  function heading(counts = match.board.counts) {
    const n = names();
    document.querySelectorAll('[data-name]').forEach(el => { el.textContent = n[Number(el.dataset.name)]; });
    $('score-0').textContent = counts[6]; $('score-1').textContent = counts[13];
    document.querySelector('.score').setAttribute('aria-label', `Hazine: ${n[0]} ${counts[6]}, ${n[1]} ${counts[13]}`);
    document.querySelector('.store-bottom .store-owner').textContent = n[0];
    document.querySelector('.store-top .store-owner').textContent = n[1];
    document.querySelector('.row-label-bottom span').firstChild.textContent = `${n[0] === 'Sen' ? 'Senin' : n[0] + 'nun'} kuyuları`;
    document.querySelector('.row-label-top span').firstChild.textContent = `${n[1] === 'Bilgisayar' ? 'Bilgisayarın' : n[1] + 'nun'} kuyuları`;
    const points = Match.score(match);
    $('match-score').hidden = match.settings.sets === 1;
    $('match-score').textContent = `Maç ${points[0].toLocaleString('tr')} — ${points[1].toLocaleString('tr')} · Set ${match.setNumber}/5`;
    const title = document.querySelector('.turn-title');
    title.classList.toggle('upper-turn', match.board.player === 1);
    title.textContent = activity === 'animating' ? 'Taşlar dağılıyor' : activity === 'hint' ? 'İpucu aranıyor' :
      paused ? 'Oyun bekliyor' : match.board.status === 'finished' ? 'Set tamamlandı' :
      !humanTurn() ? 'Bilgisayar düşünüyor' : match.settings.mode === 'local' ? `Sıra ${n[match.board.player]}da` : 'Sıra sende';
    $('selection-note').textContent = activity === 'animating' ? 'Son taşı takip et' :
      match.board.status === 'finished' ? `${counts[6]} — ${counts[13]}` :
      activity === 'hint' ? 'Hamlen değişmeden bekliyor' : paused ? 'Hazır olunca devam et' :
      !humanTurn() ? 'Birazdan hamlesini göreceksin' : match.board.lastMove?.extraTurn ? 'Bir hamle daha · Bir kuyu seç' : 'Bir kuyu seç';
    $('mode-summary').textContent = `${match.settings.mode === 'local' ? 'İki kişi' : 'Bilgisayara karşı · ' + levels[match.settings.difficulty]} · ${match.settings.sets === 5 ? '5 set' : 'Tek set'}`;
  }
  function paint() {
    const playable = !paused && activity === 'idle' && humanTurn() ? B.legalMoves(match.board) : [];
    D.render(match.board.counts, { names: names(), legal: playable, selected: hint, busy: activity !== 'idle' || paused });
    heading();
    $('undo').disabled = !match.history.length;
    $('hint').disabled = paused || activity !== 'idle' || !humanTurn() || match.board.status !== 'playing';
    $('skip-animation').hidden = activity !== 'animating';
    $('move-note').textContent = message;
    const ended = match.board.status === 'finished' && activity !== 'animating';
    $('result-note').hidden = !ended;
    if (ended) {
      const n = names(), result = match.board.result;
      const complete = Match.isComplete(match), matchWinner = Match.winner(match);
      const label = p => p === null ? 'Beraberlik' : `${n[p]} kazandı`;
      $('result-title').textContent = complete && match.settings.sets === 5 ? `Maç bitti · ${label(matchWinner)}` : label(result.winner);
      $('result-detail').textContent = `Set ${match.setNumber}: ${n[0]} ${result.scores[0]}, ${n[1]} ${result.scores[1]}.`;
      $('set-history').textContent = match.settings.sets === 5 ? `Maç puanı ${Match.score(match).join(' — ')}. ` + match.results.map(r => `${r.set}. set: ${r.scores.join('–')}`).join(' · ') : 'Bir set daha oynamak için yeni oyun başlatabilirsin.';
      $('next-set').hidden = complete;
      $('result-new').hidden = !complete;
    }
  }
  function summary(state) {
    const last = state.lastMove, name = names()[last.player];
    if (state.status === 'finished') return `${name} oynadı. Set bitti: ${state.counts[6]}–${state.counts[13]}. ${state.result.winner === null ? 'Beraberlik.' : names()[state.result.winner] + ' kazandı.'}`;
    return `${name} oynadı.${last.captured ? ` ${last.captured} taş kazandı.` : ''} ${last.extraTurn ? 'Bir hamle daha.' : 'Sıra ' + names()[state.player] + '.'}`;
  }
  async function play(pit) {
    if (paused || activity !== 'idle' || !B.legalMoves(match.board).includes(pit)) return false;
    const previous = match.board.counts.slice();
    const outcome = Match.play(match, pit);
    cancelWork();
    const token = epoch;
    controller = new AbortController();
    match = outcome.match; // Commit once, before any visual intermediate state.
    activity = 'animating'; hint = pit; message = '';
    // Paint controls with the new model, but start the visual board at the prior state.
    paint();
    D.render(previous, { selected: pit, busy: true }); heading(previous);
    const completed = await D.animate(previous, outcome.events, match.board.counts, {
      signal: controller.signal, reduced: reduced.matches,
      onEvent: e => { if (sound && (e.type === 'drop' || e.type === 'capture')) Kit.ses.cal('tas'); },
    });
    if (token !== epoch || !completed) return false;
    activity = 'idle'; controller = null; hint = null;
    message = summary(match.board);
    paint(); announce(message);
    if (match.board.status === 'finished') $('result-title').focus();
    else scheduleComputer();
    return true;
  }
  async function scheduleComputer() {
    if (paused || activity !== 'idle' || humanTurn() || match.board.status !== 'playing') return;
    const token = epoch;
    controller = new AbortController(); activity = 'thinking'; paint();
    try {
      const result = await M.ai.search(match.board, { difficulty: match.settings.difficulty, signal: controller.signal });
      if (token !== epoch || !result || paused) return;
      activity = 'idle'; controller = null;
      await play(result.move);
    } catch (error) {
      if (token !== epoch) return;
      activity = 'idle'; controller = null;
      message = 'Bilgisayar araması tamamlanamadı; yasal bir hamleyle devam ediyor.';
      console.error(error);
      const move = B.legalMoves(match.board)[0];
      if (move !== undefined) await play(move);
    }
  }
  function newGame(settings = match?.settings || readSettings(), controls = {}) {
    cancelWork();
    match = Match.createMatch(settings, controls);
    saveSettings(match.settings); message = ''; paused = false;
    paint();
    announce(`${names()[match.board.player]} kurayı kazandı. Yeni oyun başladı.`);
    scheduleComputer();
  }
  function undo() {
    if (!match.history.length) return;
    cancelWork(); match = Match.undo(match); message = 'Son kararına geri döndün.';
    paint(); announce(message); scheduleComputer();
  }
  async function showHint() {
    if (paused || activity !== 'idle' || !humanTurn() || match.board.status !== 'playing') return;
    const token = epoch;
    controller = new AbortController(); activity = 'hint'; hint = null; paint();
    const result = await M.ai.search(match.board, { difficulty: 'hard', signal: controller.signal });
    if (token !== epoch || !result || paused) return;
    activity = 'idle'; controller = null; hint = result.move;
    message = `${result.move < 6 ? result.move + 1 : result.move - 6}. kuyu önerisi: ${M.ai.explain(match.board, result.move)} ${result.solved ? 'Bu konum sonuna kadar arandı.' : 'Süreli arama önerisi; kesin çözüm değildir.'}`;
    paint(); announce(message);
  }
  function openNote(id) {
    cancelWork(); paused = true; paint();
    $(id).showModal();
  }
  function closeNote(id) { $(id).close(); }
  for (const id of ['help-dialog', 'settings-dialog']) {
    $(id).addEventListener('close', () => {
      paused = false; paint(); scheduleComputer();
    });
  }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeNote(button.dataset.close)));
  $('settings-open').addEventListener('click', () => {
    for (const key of ['mode', 'difficulty', 'sets']) form.elements[key].value = match.settings[key];
    form.elements.preview.checked = match.settings.preview;
    form.elements.difficulty.disabled = match.settings.mode === 'local';
    openNote('settings-dialog');
  });
  form.elements.mode.addEventListener('change', () => { form.elements.difficulty.disabled = form.elements.mode.value === 'local'; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const settings = { mode: form.elements.mode.value, difficulty: form.elements.difficulty.value,
      sets: Number(form.elements.sets.value), preview: form.elements.preview.checked };
    closeNote('settings-dialog'); newGame(settings);
  });
  $('new-game').addEventListener('click', () => newGame());
  $('result-new').addEventListener('click', () => newGame());
  $('undo').addEventListener('click', undo);
  $('hint').addEventListener('click', showHint);
  $('skip-animation').addEventListener('click', D.skip);
  reduced.addEventListener('change', () => { if (reduced.matches) D.skip(); });
  $('next-set').addEventListener('click', () => {
    cancelWork(); match = Match.nextSet(match); message = ''; paint();
    announce(`${match.setNumber}. set başladı. Sıra ${names()[match.board.player]}.`);
    scheduleComputer();
  });
  $('sound').addEventListener('click', () => {
    sound = !sound;
    Kit.ses.sessizYap(!sound);
    if (sound) { Kit.ses.baslat(); Kit.ses.cal('tas'); }
    $('sound').setAttribute('aria-pressed', String(sound));
    $('sound').setAttribute('aria-label', sound ? 'Sesi kapat' : 'Sesi aç');
    $('sound').title = sound ? 'Sesi kapat' : 'Sesi aç';
    document.querySelector('.sound-text').textContent = sound ? 'Ses açık' : 'Ses kapalı';
    $('sound-icon').classList.toggle('sound-on', sound);
  });
  board.addEventListener('click', event => {
    const button = event.target.closest('.pit');
    if (button && button.getAttribute('aria-disabled') !== 'true') play(Number(button.dataset.position));
  });
  function preview(button) {
    const pit = Number(button.dataset.position);
    if (match.settings.preview && activity === 'idle' && humanTurn() && B.legalMoves(match.board).includes(pit)) {
      $('move-note').textContent = `Bu hamle: ${M.ai.explain(match.board, pit)}`;
    }
  }
  board.addEventListener('focusin', event => {
    if (!event.target.matches('.pit')) return;
    board.querySelectorAll('.pit').forEach(pit => { pit.tabIndex = pit === event.target ? 0 : -1; });
    preview(event.target);
  });
  board.addEventListener('pointerover', event => { const pit = event.target.closest('.pit'); if (pit) preview(pit); });
  board.addEventListener('pointerleave', () => { $('move-note').textContent = message; });
  document.addEventListener('keydown', event => {
    // İpucu düğmesi arama sırasında odağını kaybedebilir. Escape tahtanın
    // dışında da çalışır; açık notların kendi Escape davranışına karışmaz.
    if (event.key !== 'Escape' || paused ||
        (activity !== 'hint' && (activity !== 'idle' || hint === null))) return;
    event.preventDefault();
    if (activity === 'hint') cancelWork();
    hint = null; message = ''; paint();
    announce('İpucu kapatıldı.');
  });
  board.addEventListener('keydown', event => {
    const button = event.target.closest('.pit'); if (!button) return;
    const position = Number(button.dataset.position), row = D.visualRows[position < 6 ? 1 : 0], column = row.indexOf(position);
    let next = position;
    if (event.key === 'ArrowLeft') next = row[Math.max(0, column - 1)];
    else if (event.key === 'ArrowRight') next = row[Math.min(5, column + 1)];
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') next = 12 - position;
    else if (event.key === 'Home') next = row[0];
    else if (event.key === 'End') next = row[5];
    else return;
    event.preventDefault();
    board.querySelector(`[data-position="${next}"]`).focus();
  });

  // Öğretici ayrı durumlarla gerçek motoru kullanır, match'e hiçbir zaman yazmaz.
  const exampleState = (entries, player = 0) => {
    const state = B.createInitialState(player); state.counts.fill(0);
    Object.entries(entries).forEach(([i, n]) => { state.counts[i] = n; });
    state.counts[13] += 48 - state.counts.reduce((a, b) => a + b, 0);
    return state;
  };
  const examples = [
    { title: 'İlk taş kaynakta kalır', state: B.createInitialState(), pit: 0, note: 'Alt sıranın 1. kuyusundaki dört taş: biri yerinde, üçü sonraki kuyularda.' },
    { title: 'Hazine ve ek hamle', state: B.createInitialState(), pit: 3, note: 'Alt sıranın 4. kuyusundan başla. Son taş kendi hazinene ulaşır.' },
    { title: 'Çift sayıda taş kazanma', state: exampleState({ 0: 2, 5: 3, 7: 3, 10: 2 }), pit: 5, note: 'Alt sıranın 6. kuyusu: son taş üstteki 1. kuyuyu dört yapar.' },
    { title: 'Boş kuyu ve karşıdan alma', state: exampleState({ 0: 1, 4: 2, 11: 6, 7: 3 }), pit: 0, note: 'Alt sıranın 1. kuyusu: tek taş boş 2. kuyuya düşer, karşıdaki altı taşı da alır.' },
  ];
  let examplePlayed = false;
  function renderExample() {
    const example = examples[Number($('example-select').value)];
    const state = examplePlayed ? B.applyMove(example.state, example.pit).state : example.state;
    $('example-title').textContent = example.title;
    $('example-note').textContent = examplePlayed ? M.ai.explain(example.state, example.pit) : example.note;
    $('example-board').replaceChildren();
    for (const row of [[13], ...D.visualRows, [6]]) {
      const line = document.createElement('div'); line.className = row.length === 1 ? 'example-store' : 'example-row';
      row.forEach(pit => {
        const cell = document.createElement('span'); cell.textContent = row.length === 1 ? `${pit === 6 ? 'Alt' : 'Üst'} hazine: ${state.counts[pit]}` : state.counts[pit];
        if (pit === example.pit && !examplePlayed) cell.className = 'example-source';
        cell.setAttribute('aria-label', row.length === 1 ? cell.textContent : `${pit < 6 ? 'Alt' : 'Üst'} ${pit < 6 ? pit + 1 : pit - 6}. kuyu: ${state.counts[pit]} taş`);
        line.append(cell);
      });
      $('example-board').append(line);
    }
    $('example-play').disabled = examplePlayed;
  }
  $('help-open').addEventListener('click', () => { examplePlayed = false; renderExample(); openNote('help-dialog'); });
  $('example-select').addEventListener('change', () => { examplePlayed = false; renderExample(); });
  $('example-play').addEventListener('click', () => { examplePlayed = true; renderExample(); });
  $('example-reset').addEventListener('click', () => { examplePlayed = false; renderExample(); });
  D.decorations();
  M.app = { newGame, play, undo, showHint, skip: D.skip,
    snapshot: () => JSON.parse(JSON.stringify(match)), activity: () => activity };
  newGame();
})();
