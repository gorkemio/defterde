(function () {
  'use strict';
  const TD = window.TD, Kit = window.Kit, L = TD.layout;
  const $ = id => document.getElementById(id);
  const cells = new Map();
  let focus = 20;
  const store = TD.settings.create();
  let settings = store.read(), orientation = null, tutorial = null, savedFocus = null;

  Kit.malzeme.sec('kursunkalem', TD.config);
  function updateSound() {
    Kit.ses.sessiz = !settings.sound;
    Kit.ses.durdur();
    Kit.ses.seviye(.25);
    $('ses').setAttribute('aria-pressed', String(settings.sound));
    $('ses').setAttribute('aria-label', settings.sound ? 'Ses açık' : 'Ses kapalı');
    $('ses').querySelector('.yazi').textContent = settings.sound ? 'Ses açık' : 'Ses kapalı';
    $('ses-simge').classList.toggle('acik', settings.sound);
  }
  TD.draw.sesSimgesi($('ses-simge'), TD.config.renk.kursun);
  updateSound();
  const scene = TD.draw.kur($('tahta-cizim'), { motion: () => settings.motion });
  TD.draw.ornek($('sen-tas'), 'sen-ornek', 'mavi');
  TD.draw.ornek($('rakip-tas'), 'rakip-ornek', 'kirmizi');
  TD.draw.ornek($('dama-ornek'), 'dama-ornek', 'mavi', true);
  TD.draw.ornek($('dama-ornek-kirmizi'), 'dama-ornek-kirmizi', 'kirmizi', true);
  TD.draw.ornek($('ogretici-dama'), 'ogretici-dama', 'mavi', true);
  // Mavi, aldığı kırmızı taşları biriktirir; kırmızı da mavileri.
  const yiginlar = { mavi: TD.draw.yigin($('mavi-alinan'), 'kirmizi'), kirmizi: TD.draw.yigin($('kirmizi-alinan'), 'mavi') };
  TD.draw.altCizgi($('baslik-cizgi'), TD.config.renk.kirmizi, 'baslik', 2.8);
  const resultNote = TD.result.create($('sonuc'));

  function note(state) {
    const demo = tutorial?.read();
    if (demo) return demo.error || demo.lesson.notes[demo.index];
    if (state.error) return 'Hamle tamamlanamadı. Yeniden deneyebilir ya da yeni oyun açabilirsin.';
    const result = state.game?.result;
    if (result) return ({
      'no-pieces': 'Rakibin taşı kalmadı.',
      blocked: 'Rakibin oynayabileceği hamle kalmadı.',
      'one-each': 'İki tarafta da birer taş kaldı.',
      repetition: 'Aynı konum üçüncü kez oluştu.',
      agreement: 'Beraberlik kabul edildi.',
    })[result.reason];
    if (state.busy === 'moves') return 'Sıradaki hamleler hazırlanıyor…';
    if (state.busy === 'ai') return 'Bilgisayar düşünüyor…';
    if (state.busy === 'hint') return 'Bir yol arıyorum…';
    if (state.busy === 'offer') return state.mode === 'ai' ? 'Bilgisayar teklifi düşünüyor…' : 'Diğer oyuncunun yanıtı bekleniyor.';
    if (state.notice) return state.notice;
    if (state.hint) return 'İpucu: ' + [state.selected ?? state.hint.from, ...state.hint.landings.slice(state.prefix.length)].map(L.name).join(' → ');
    const captures = state.legal[0]?.captures.length || 0;
    if (state.prefix.length && captures > state.prefix.length) return `Aynı taşla devam et · ${captures - state.prefix.length} alma kaldı.`;
    if (captures) return `Almak zorundasın · Bu tur ${captures} taş.`;
    if (state.selected != null) return settings.help ? 'İşaretli karelerden birini seç.' : 'Taşın gideceği kareyi seç.';
    return 'Bir taş seç, sonra gideceği kareyi.';
  }

  function render(state) {
    const demo = tutorial?.read();
    scene.render(settings.help || demo ? state : { ...state, targets: [] });
    const flipped = state.mode === 'ai' && state.human === -1;
    if (orientation !== flipped) {
      orientation = flipped;
      const rows = [...$('hucreler').children];
      L.rows.forEach((squares, y) => squares.forEach((square, x) => {
        const el = cells.get(flipped ? 63 - square : square);
        el.setAttribute('aria-colindex', String(x + 1));
        rows[y].appendChild(el);
      }));
      document.querySelectorAll('.satir-adlari span').forEach((el, i) => { el.textContent = flipped ? i + 1 : 8 - i; });
      document.querySelectorAll('.sutun-adlari span').forEach((el, i) => { el.textContent = 'abcdefgh'[flipped ? 7 - i : i]; });
      $('oyun-alani').dataset.cevrik = String(flipped);
    }
    const result = state.game?.result, turn = state.position.turn;
    const humanTurn = state.mode === 'local' || state.position.turn === state.human;
    $('sira-yazi').textContent = result
      ? result.winner === 0 ? 'Berabere!' : result.winner === 1 ? 'Mavi kazandı!' : 'Kırmızı kazandı!'
      : state.mode === 'ai' && !demo ? humanTurn ? 'Sıra sende' : 'Sıra bilgisayarda'
        : turn === 1 ? 'Sıra mavide' : 'Sıra kırmızıda';
    $('sira').dataset.takim = (result?.winner ?? turn) === -1 ? 'kirmizi' : 'mavi';
    $('sira').classList.toggle('sonuc', !!result);
    const kalan = { mavi: state.position.cells.filter(p => p > 0).length, kirmizi: state.position.cells.filter(p => p < 0).length };
    $('mavi-sayi').textContent = kalan.mavi;
    $('kirmizi-sayi').textContent = kalan.kirmizi;
    $('skor').setAttribute('aria-label', `Kalan taş: mavi ${kalan.mavi}, kırmızı ${kalan.kirmizi}`);
    yiginlar.mavi.goster(demo ? 0 : 16 - kalan.kirmizi);
    yiginlar.kirmizi.goster(demo ? 0 : 16 - kalan.mavi);
    $('geri-al').disabled = !demo && !state.canUndo;
    $('ipucu').disabled = !!demo || !!state.busy || !!result || !humanTurn;
    $('beraberlik').disabled = !!demo || !!state.busy || !!result || !!state.prefix.length || !humanTurn;
    const ad = { mavi: state.mode === 'local' ? 'Mavi' : state.human === 1 ? 'Sen' : 'Bilgisayar',
      kirmizi: state.mode === 'local' ? 'Kırmızı' : state.human === -1 ? 'Sen' : 'Bilgisayar' };
    for (const takim of ['mavi', 'kirmizi']) $(takim + '-ad').textContent = $(takim + '-yan-ad').textContent = ad[takim];
    $('oyun-notu').textContent = demo ? 'Öğretici · Asıl oyunun seni bekliyor'
      : state.mode === 'local' ? 'Aynı cihazda iki kişi · Mavi başlar'
        : `Bilgisayara karşı · ${{ easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[state.level]} · Mavi başlar`;
    $('ogretici-bant').hidden = !demo;
    if (demo) {
      $('ogretici-durum').textContent = demo.lesson.title + (demo.running ? ' · İzliyorsun' : ' · Örnek tamamlandı');
      $('ornek-tekrar').disabled = demo.running;
    }
    if (typeof state.offer === 'number') {
      $('teklif-yazi').textContent = state.offer === 1 ? 'Mavi teklif etti. Kırmızı, kabul ediyor musun?' : 'Kırmızı teklif etti. Mavi, kabul ediyor musun?';
      if (!$('teklif').open) $('teklif').showModal();
    } else if ($('teklif').open) $('teklif').close();
    $('hucreler').setAttribute('aria-busy', String(!!state.busy));
    $('hucreler').dataset.durum = state.busy || (result ? 'bitti' : 'hazir');
    $('kenar-notu').textContent = note(state);
    for (const [square, el] of cells) {
      const piece = state.position.cells[square], target = state.targets.includes(square);
      const team = piece > 0 ? 'mavi' : 'kırmızı';
      if (piece) el.dataset.tas = piece > 0 ? 'mavi' : 'kirmizi';
      else delete el.dataset.tas;
      el.dataset.hedef = String(target);
      el.dataset.secilebilir = String(state.selectable.includes(square));
      el.setAttribute('aria-selected', String(square === state.selected));
      el.setAttribute('aria-disabled', String(!!demo || !!state.busy || !!result));
      el.setAttribute('aria-label', `${L.name(square)}, ${piece ? team + (Math.abs(piece) === 2 ? ' dama' : ' taş') : 'boş'}${target ? ', gidilebilir kare' : ''}`);
    }
    if (!state.busy) {
      const selected = state.selected == null ? '' : `${L.name(state.selected)} seçildi. `;
      $('duyuru').textContent = `${$('sira-yazi').textContent}. ${selected}${note(state)}`;
    } else if (['ai', 'hint', 'offer'].includes(state.busy)) $('duyuru').textContent = note(state);
    resultNote.render(state, { demo: !!demo, motion: settings.motion });
  }
  const session = TD.session.create({ ...settings, onChange: render, animate: async step => {
    if (settings.sound) Kit.ses.cal('kayma');
    await scene.animate(step);
    if (settings.sound && !step.signal.aborted) Kit.ses.cal('tas');
  } });

  function focusSquare(square, moveFocus = false) {
    cells.get(focus).tabIndex = -1;
    focus = square;
    cells.get(square).tabIndex = 0;
    if (moveFocus) cells.get(square).focus({ preventScroll: true });
  }
  L.rows.forEach((squares, y) => {
    const row = document.createElement('div');
    row.className = 'tahta-satir';
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(y + 1));
    squares.forEach((square, x) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hucre';
      el.dataset.kare = L.name(square);
      el.setAttribute('role', 'gridcell');
      el.setAttribute('aria-colindex', String(x + 1));
      el.tabIndex = square === focus ? 0 : -1;
      el.addEventListener('click', () => {
        if (tutorial?.read()) return;
        focusSquare(square);
        session.choose(square);
      });
      el.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        focusSquare(L.navigate(square, e.key, orientation), true);
      });
      cells.set(square, el);
      row.appendChild(el);
    });
    $('hucreler').appendChild(row);
  });

  function size() {
    document.querySelectorAll('.sozcuk').forEach(btn => {
      if (btn.offsetWidth) Kit.kalem.dugmeAltiCiz(btn, 0, true, { stroke: TD.config.renk.kursun }, 0);
    });
  }
  function help(open) {
    const dialog = $('nasil-not');
    if (open) {
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      $('nasil').setAttribute('aria-expanded', 'true');
      $('nasil-baslik').focus({ preventScroll: true });
    } else if (dialog.open) dialog.close();
  }
  $('nasil').addEventListener('click', () => help(true));
  $('nasil-kapat').addEventListener('click', () => help(false));
  $('nasil-not').addEventListener('close', () => {
    if ($('nasil-not').open) return;
    $('nasil').setAttribute('aria-expanded', 'false');
    render(session.read());
    const active = document.activeElement;
    if (!document.querySelector('dialog[open]') && (active === document.body || $('nasil-not').contains(active))) {
      $('nasil').focus({ preventScroll: true });
    }
  });
  $('yeni-oyun').addEventListener('click', () => {
    Kit.ses.durdur();
    const demo = tutorial.read();
    if (demo) { tutorial.discard(); savedFocus = null; }
    focusSquare(settings.mode === 'ai' && settings.human === -1 ? 44 : 20);
    if (demo) session.configure(settings);
    else session.start();
  });
  $('geri-al').addEventListener('click', () => {
    Kit.ses.durdur();
    if (tutorial.read()) returnToGame();
    else session.undo();
  });
  $('ipucu').addEventListener('click', () => session.hint());
  function showComputerOptions() {
    const local = $('ayar-form').elements.mode.value === 'local';
    document.querySelectorAll('.ai-ayari').forEach(group => {
      group.hidden = local;
      group.disabled = local;
    });
  }
  $('ayar-form').addEventListener('change', e => {
    if (e.target.name === 'mode') showComputerOptions();
  });
  $('ayarlar-ac').addEventListener('click', () => {
    const form = $('ayar-form');
    for (const key of ['mode', 'human', 'level', 'motion']) form.elements[key].value = settings[key];
    form.elements.help.checked = settings.help;
    showComputerOptions();
    $('ayarlar').showModal();
  });
  $('ayarlar-kapat').addEventListener('click', () => $('ayarlar').close());
  $('ayar-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    settings = store.save({ mode: form.elements.mode.value, human: +form.elements.human.value,
      level: form.elements.level.value, motion: form.elements.motion.value, help: form.elements.help.checked });
    $('ayarlar').close();
    if (tutorial.read()) { tutorial.discard(); savedFocus = null; }
    Kit.ses.durdur();
    focusSquare(settings.mode === 'ai' && settings.human === -1 ? 44 : 20);
    session.configure(settings);
  });
  $('beraberlik').addEventListener('click', () => {
    $('ayarlar').close(); session.offerDraw();
  });
  $('teklif-kabul').addEventListener('click', () => session.respondDraw(true));
  $('teklif-ret').addEventListener('click', () => session.respondDraw(false));
  $('teklif').addEventListener('cancel', e => { e.preventDefault(); session.respondDraw(false); });
  for (const id of ['ayarlar', 'teklif']) $(id).addEventListener('close', () => {
    render(session.read());
    const active = document.activeElement;
    if (!document.querySelector('dialog[open]') && (active === document.body || $(id).contains(active))) {
      $('ayarlar-ac').focus({ preventScroll: true });
    }
  });
  $('sonuc-yeni').addEventListener('click', () => {
    $('sonuc').close();
    $('yeni-oyun').click();
  });
  $('sonuc-kapat').addEventListener('click', () => {
    $('sonuc').close();
    focusSquare(focus, true);
  });
  $('ses').addEventListener('click', () => {
    settings = store.save({ sound: !settings.sound });
    updateSound();
    if (settings.sound) { Kit.ses.baslat(); Kit.ses.cal('grafit', 0, 120); }
    size();
  });
  for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => {
    if (settings.sound) Kit.ses.baslat();
  }, { capture: true });
  tutorial = TD.tutorial.create(session, { onChange: () => render(session.read()) });
  function watchExample(id) {
    help(false);
    if (!tutorial.read()) savedFocus = focus;
    Kit.ses.durdur();
    tutorial.watch(id);
    $('oyuna-don').focus({ preventScroll: true });
    $('ogretici-bant').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  async function returnToGame() {
    const oldFocus = savedFocus;
    savedFocus = null;
    Kit.ses.durdur();
    await tutorial.stop();
    if (oldFocus != null) focusSquare(oldFocus, true);
  }
  document.querySelectorAll('[data-ornek]').forEach(el => el.addEventListener('click', () => watchExample(el.dataset.ornek)));
  $('ornek-tekrar').addEventListener('click', () => watchExample(tutorial.read().lesson.id));
  $('oyuna-don').addEventListener('click', returnToGame);
  window.addEventListener('pagehide', () => {
    if (tutorial.read()) tutorial.stop();
    Kit.ses.durdur(); session.suspend();
  });
  window.addEventListener('pageshow', e => { if (e.persisted) session.resume(); });
  let raf;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(size);
  }).observe($('sayfa'));
  // Hazır örneklerin de aynı oturumu kullanabilmesi için dar kontrolör arayüzü.
  TD.ui = Object.freeze({ start: p => session.start(p), read: session.read,
    configure: values => { settings = TD.settings.validate({ ...settings, ...values }); return session.configure(settings); },
    tutorial: () => tutorial.read() });
  Promise.all([Kit.kalem.fontBekle(), session.start()]).then(() => {
    size();
    document.documentElement.dataset.hazir = 'true';
  });
})();
