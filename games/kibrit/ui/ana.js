// ui/ana.js — açılış: malzeme (kurşun kalem), sesler, ölçü, fontlar, komutlar; oyun doğrudan Maç ile başlar.
(function () {
  'use strict';
  const KB = window.KB;
  const $ = (id) => document.getElementById(id);
  async function basla() {
    if (!window.rough || !window.Kit || !Kit.kalem) { if (window.Kit && Kit.kalem) Kit.kalem.kalemYok(); return; }
    Kit.malzeme.sec('kursunkalem');
    Kit.ses.kur({ anahtar: 'kb-sessiz' });
    KB.sesler.kur();
    Kit.ses.seviye(KB.config.sesSeviye);
    const ilk = () => Kit.ses.baslat();
    document.addEventListener('pointerdown', ilk, { once: true, capture: true });
    document.addEventListener('keydown', ilk, { once: true, capture: true });
    KB.sahne.olc();
    await KB.sahne.fontlar();
    Kit.kalem.harfle($('baslik'), 'Kibrit', { tohum: ['baslik'], anlik: true });
    baslikAltiCiz();
    komutlar();
    KB.ayarlar.kur();
    // sayfa dibindeki not: kalemle çizilmiş kutu
    const spot = { yenile: dipnotCiz };
    dipnotCiz();
    if (window.ResizeObserver) { let son = ''; new ResizeObserver(() => requestAnimationFrame(() => { const el = $('spot'), k = el.offsetWidth + 'x' + el.offsetHeight; if (k !== son) { son = k; dipnotCiz(); } })).observe($('spot')); }
    // defterin yanık köşeleri: açık defterde dış köşeler (sol sayfanın sol altı, sağ sayfanın sağ üstü), tek sayfada sağ üst
    // ve sağ alt; alttaki yaprak da kavrulur. Sayfa boyu değiştikçe yeniden.
    const yak = () => {
      const dar = document.body.dataset.duzen === 'dar';
      // yanık derinliği kare ölçüsüyle: komut ve başlık satırlarına değmesin
      const q = KB.sahne.O.sq;
      const derin = dar ? [[34, 58], [28, 48]] : [[2.6 * q, 3.9 * q], [2.2 * q, 3.3 * q]];
      Kit.yanik.sayfa($('sayfa'), { tohum: ['sayfa', 'sol'], koseler: dar ? [1, 2] : [3], yaricap: dar ? 0 : 7, yuvarlak: dar ? [] : [0, 3], altKap: $('defter'), derin });
      if (!dar) Kit.yanik.sayfa($('sayfa-sag'), { tohum: ['sayfa', 'sag'], koseler: [1], yaricap: 7, yuvarlak: [1, 2], altKap: $('defter'), derin });
      else { $('sayfa-sag').style.clipPath = ''; const a = $('defter').querySelector('svg.alt-yanik[data-sayfa="alt-yanik-sayfa-sag"]'); if (a) a.remove(); }
    };
    yak();
    if (window.ResizeObserver) {
      let son = '';
      // çizim gözlenen kutuyu büyütebilir; bir sonraki kareye bırakılır (ResizeObserver döngü uyarısı olmasın)
      new ResizeObserver(() => requestAnimationFrame(() => {
        const k = ['sayfa', 'sayfa-sag'].map(id => $(id).offsetWidth + 'x' + $(id).offsetHeight).join('|') + document.body.dataset.duzen;
        if (k !== son) { son = k; yak(); KB.marj.ceteleYenile(); }
      })).observe($('defter'));
    }
    // Yeniden ölçüm: genişlik değiştiyse; açık defterde yükseklik de (telefonda yalnız yükseklik değişimi — adres çubuğu —
    // yok sayılır). Kurulmuş sahne yeni çöp boyunu bir sonraki turda alır; bu turda kutuya sığacak kadar küçülür.
    function yeniden() {
      const { vw, vh } = Kit.kalem.alan(), O = KB.sahne.O;
      if (Math.abs(vw - O.vw) < 2 && (O.duzen === 'dar' || Math.abs(vh - O.vh) < 2)) return;
      KB.sahne.olc();
      const t = KB.oyun.tur;
      if (t && t.kupur) t.kupur.yenile();
      if (t && t.rakipKart) t.rakipKart.yenile();
      spot.yenile();
      KB.marj.yenidenCiz();
      baslikAltiCiz();
      KB.sahne.ekAyarla();
    }
    let z = 0;
    addEventListener('resize', () => { clearTimeout(z); z = setTimeout(yeniden, 180); });
    Kit.kalem.fontGelince(() => KB.marj.yenidenCiz(), 'Kalam', 'AİŞĞÇÖÜ');
    await KB.modlar.Mac.basla();
    yeniden();                         // açılış sırasında pencere boyutu değiştiyse
    KB.hazir = true;
    document.documentElement.dataset.hazir = '1';
  }
  // Sayfa dibindeki not kalemle çizilmiş bir kutu içinde
  function dipnotCiz() {
    const el = $('spot');
    let svg = el.querySelector(':scope > svg.cerceve-iz');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'cerceve-iz'); svg.setAttribute('aria-hidden', 'true'); el.insertBefore(svg, el.firstChild); }
    svg.innerHTML = '';
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    const K = Kit.kalem.kalemYap(svg);
    Kit.kalem.kutu(K, svg, 2, 2, w - 4, h - 4, { tohum: ['dipnot'], tasma: 5, cizgi: { stroke: '#b4382e', strokeWidth: 1.1, roughness: .9 }, anlik: true });
  }
  // Başlığın altında kırmızı kurşun kalem çizgisi (defter ailesinin başlık dili)
  function baslikAltiCiz() {
    const h1 = document.querySelector('.baslik'), y = $('baslik');
    let svg = h1.querySelector(':scope > svg.alti');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'alti'); svg.setAttribute('aria-hidden', 'true'); h1.appendChild(svg); }
    svg.innerHTML = '';
    const w = y.offsetWidth, h = h1.offsetHeight;
    if (!w) return;
    svg.setAttribute('width', w + 12); svg.setAttribute('height', h + 8); svg.setAttribute('viewBox', `-6 0 ${w + 12} ${h + 8}`);
    const K = Kit.kalem.kalemYap(svg);
    Kit.kalem.altiCiz(K, svg, 2, w - 2, h - 1, { tohum: ['baslik-alti'], ek: { stroke: '#b4382e', strokeWidth: 2 }, anlik: true, tasma: [3, 9] });
  }
  function komutlar() {
    const X = KB.modlar, O = KB.oyun;
    $('k-sonraki').addEventListener('click', () => { const f = O.sonraki; X.sonrakiGizle(); if (f) f(); });
    $('k-geri').addEventListener('click', () => { if (O.tur && O.tur.etk) O.tur.etk.geriAl(); });
    $('k-bastan').addEventListener('click', () => { if (O.tur && O.tur.etk) O.tur.etk.bastan(); });
    $('k-ipucu').addEventListener('click', () => X.ipucu());
    $('k-pes').addEventListener('click', () => { const t = O.tur; if (t && !t.bitti && t.o.onPes) t.o.onPes(t); });
    $('k-paylas').addEventListener('click', () => X.Gun.paylas());
    $('k-yeni').addEventListener('click', () => {
      const m = O.mod;
      if (m === 'mac') return X.Mac.basla();
      if (m === 'hepsini') return X.Hep.tur();
      if (m === 'boz') return X.Boz.basla();
      if (m === 'kitap') return X.Kitap.icindekiler();
      if (m === 'sonsuz') return X.Sonsuz.sonraki();
      if (m === 'ikiKisi') return X.Iki.basla();
      return X.Mac.basla();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (O.tur && O.tur.etk) O.tur.etk.geriAl(); }
    });
    document.querySelectorAll('.komutlar .dugme').forEach(b => b.addEventListener('pointerenter', () => Kit.kalem.dugmeAltiVurgu(b)));
    // klavye odağı: kurşun kalemle çerçeve (fareyle basınca çizilmez)
    document.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && b.matches(':focus-visible')) Kit.kalem.odakCiz(b); });
    document.addEventListener('focusout', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) Kit.kalem.odakSil(b); });
  }
  basla().catch(e => { console.error(e); const p = document.createElement('p'); p.className = 'uyari'; p.textContent = 'Defter açılamadı: ' + e.message; document.body.prepend(p); });
})();
