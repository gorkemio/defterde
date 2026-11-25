// ui/kendi.js — Kendi resmini yap: ekranda piksel çizilir (12 renk), tekillik kontrol edilir, gerekirse başlangıç kareleri
// otomatik eklenir; resim bağlantıyla paylaşılır (ızgara URL'de sıkıştırılmış: #kendi=v1.en.boy.…&ad=…&cizen=…).
// Arkadaş bulmacayı çözer; bitişte "Çizen: Ayşe" yazar.
(function () {
  'use strict';
  const KK = window.KK;
  const KL = Kit.kalem, BY = Kit.boyama;
  const $ = (id) => document.getElementById(id);
  const el = (ad, sinif, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; };
  const S = { en: 10, boy: 10, g: null, renk: 1, sonuc: null, cv: null, k: 20 };

  function resimden(kod, ad, cizen) {
    const v = KK.model.koduOku(kod), n = v.en * v.boy;
    const renk = new Array(n).fill(null), cozum = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (v.renkler[i]) { cozum[i] = 1; renk[i] = BY.PALET12[BY.SIRA[v.renkler[i] - 1]] || BY.PALET12.siyah; }
    return {
      id: 'kendi-' + KL.karma('kendi', kod).toString(36), ad: (ad || 'Resim').slice(0, 40), cizen: (cizen || '').slice(0, 30),
      tur: 'kendi', defter: 'kendi', kod, en: v.en, boy: v.boy, cozum, renk, zemin: new Array(n).fill(null), baslangic: v.baslangic, bant: '?', puan: 0,
    };
  }

  function kaydet() { KK.oyun.depo.yaz('kendi-taslak', { en: S.en, boy: S.boy, g: Array.from(S.g), ad: $('kendi-ad') ? $('kendi-ad').value : '', cizen: $('kendi-cizen') ? $('kendi-cizen').value : '' }); }

  function ac() {
    const O = KK.oyun;
    if (O.ekran === 'oyun' && O.kr) { O.kr.duraklat(); O.kaydet(); }
    O.ekran = 'kendi';
    KK.sayfa.notKapat();
    document.body.classList.remove('oyunda');
    const { vw, vh } = KL.alan(), y = KK.yerlesim.albumYerlesim({ vw, vh });
    KK.sayfa.sayfaBoyu(y);
    $('oyun-ekrani').hidden = true;
    const kap = $('album-ekrani');
    kap.hidden = false; kap.textContent = '';
    const t = O.depo.oku('kendi-taslak', null);
    if (t && t.g && t.g.length === t.en * t.boy) { S.en = t.en; S.boy = t.boy; S.g = Uint8Array.from(t.g); } else if (!S.g) S.g = new Uint8Array(S.en * S.boy);
    S.sonuc = null;
    const ust = el('div', 'album-ust');
    const geri = el('button', 'dugme sozcuk geri'); geri.type = 'button'; geri.appendChild(el('span', 'yazi', 'Defterler')); geri.addEventListener('click', () => { kaydet(); KK.defterler.ac(); });
    ust.appendChild(geri); ust.appendChild(el('h1', '', 'Kendi resmini yap'));
    kap.appendChild(ust);
    // boy
    const boyP = el('p', 'ayar-grup'); boyP.appendChild(el('span', 'ayar-ad', 'boy:'));
    [5, 10, 15, 20, 25].forEach((n, i) => {
      if (i) boyP.appendChild(el('span', 'ara', '·'));
      const b = el('button', 'ayar'); b.type = 'button'; b.appendChild(el('span', 'yazi', `${n}×${n}`));
      b.setAttribute('aria-pressed', S.en === n ? 'true' : 'false');
      b.addEventListener('click', () => { if (n === S.en) return; S.en = S.boy = n; S.g = new Uint8Array(n * n); S.sonuc = null; kaydet(); ac(); });
      boyP.appendChild(b);
    });
    kap.appendChild(boyP);
    // palet
    const pal = el('div', 'kendi-palet');
    pal.setAttribute('role', 'radiogroup'); pal.setAttribute('aria-label', 'Renk');
    const renkler = [0, ...BY.SIRA.map((_, i) => i + 1)];
    for (const r of renkler) {
      const b = el('button', 'kendi-renk'); b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', r ? BY.AD[BY.SIRA[r - 1]] : 'silgi');
      b.style.background = r ? BY.PALET12[BY.SIRA[r - 1]] : 'repeating-linear-gradient(45deg,#fbf9f2,#fbf9f2 3px,#ddd 3px,#ddd 6px)';
      b.setAttribute('aria-checked', r === S.renk ? 'true' : 'false');
      b.addEventListener('click', () => { S.renk = r; pal.querySelectorAll('.kendi-renk').forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); });
      pal.appendChild(b);
    }
    kap.appendChild(pal);
    // tuval
    const sq = y.sq, alanW = Math.min((y.Wsq - (y.duzen === 'dikey' ? 2 : y.marjX + 2)) * sq, 25 * 26);
    S.k = Math.max(10, Math.floor(alanW / S.en));
    const cv = el('canvas', 'kendi-tuval'); S.cv = cv;
    cv.setAttribute('aria-label', `${S.en}'e ${S.boy} çizim alanı`);
    kap.appendChild(cv);
    tuvalKur();
    // ad, çizen
    const p = el('p', 'ayar-grup kendi-adlar');
    const adL = el('label', '', 'resmin adı: '), ad = el('input'); ad.id = 'kendi-ad'; ad.maxLength = 40; ad.value = (t && t.ad) || ''; ad.placeholder = 'Kedim';
    const czL = el('label', '', ' çizen: '), cz = el('input'); cz.id = 'kendi-cizen'; cz.maxLength = 30; cz.value = (t && t.cizen) || ''; cz.placeholder = 'Ayşe';
    adL.appendChild(ad); czL.appendChild(cz); p.appendChild(adL); p.appendChild(czL);
    ad.addEventListener('input', kaydet); cz.addEventListener('input', kaydet);
    kap.appendChild(p);
    const durum = el('p', 'gunun-bilgi'); durum.id = 'kendi-durum'; durum.setAttribute('aria-live', 'polite');
    durum.textContent = 'Kareleri boya. Kontrol et, sonra dene ya da paylaş.';
    kap.appendChild(durum);
    const kom = el('div', 'album-kisa');
    const d = (yazi, f) => { const b = el('button', 'dugme sozcuk'); b.type = 'button'; b.appendChild(el('span', 'yazi', yazi)); b.addEventListener('click', f); kom.appendChild(b); };
    d('kontrol et', kontrol); d('dene', dene); d('bağlantıyı paylaş', paylas); d('temizle', () => { S.g.fill(0); S.sonuc = null; kaydet(); ciz(); });
    kap.appendChild(kom);
    const ta = el('textarea', 'paylasim-metni'); ta.id = 'kendi-link'; ta.readOnly = true; ta.hidden = true; ta.rows = 3;
    kap.appendChild(ta);
    const s = $('sayfa'); s.style.height = 'auto';
    requestAnimationFrame(() => {
      kap.querySelectorAll('.dugme').forEach(b => KL.dugmeAltiCiz(b, 0, true));
      kap.querySelectorAll('.ayar[aria-pressed="true"]').forEach(b => KL.dugmeAltiCiz(b, 0, true));
      s.style.height = Math.max(Math.ceil(kap.scrollHeight / sq) * sq, y.Hsq * sq) + 'px';
    });
    KK.sayfa.duyur('Kendi resmini yap.');
  }

  function tuvalKur() {
    const cv = S.cv, dpr = Math.min(2, devicePixelRatio || 1), W = S.en * S.k, H = S.boy * S.k;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    let boyuyor = null;
    const kare = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientY - r.top) / (r.height / S.boy)), Math.floor((e.clientX - r.left) / (r.width / S.en))]; };
    const boya = (e) => { const [r, c] = kare(e); if (r < 0 || c < 0 || r >= S.boy || c >= S.en) return; const i = r * S.en + c; if (S.g[i] !== boyuyor) { S.g[i] = boyuyor; S.sonuc = null; hucre(i); } };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ } const [r, c] = kare(e); const i = r * S.en + c; boyuyor = e.button === 2 ? 0 : (S.g[i] === S.renk && S.renk ? 0 : S.renk); boya(e); });
    cv.addEventListener('pointermove', (e) => { if (boyuyor !== null) boya(e); });
    const bitir = () => { if (boyuyor !== null) { boyuyor = null; kaydet(); } };
    cv.addEventListener('pointerup', bitir); cv.addEventListener('pointercancel', bitir);
    ciz();
  }
  function hucre(i) {
    const c = S.cv.getContext('2d'), k = S.k, x = (i % S.en) * k, y = ((i / S.en) | 0) * k;
    c.clearRect(x, y, k, k);
    c.fillStyle = '#fbf9f2'; c.fillRect(x, y, k, k);
    if (S.g[i]) BY.hucre(c, x, y, k, { renk: BY.PALET12[BY.SIRA[S.g[i] - 1]], tohum: ['kendi', i, S.g[i]], tasma: [0, .4] });
    c.fillStyle = (i % S.en) % 5 === 0 ? 'rgba(86,140,214,.6)' : 'rgba(86,140,214,.3)'; c.fillRect(x, y, 1, k);
    c.fillStyle = ((i / S.en) | 0) % 5 === 0 ? 'rgba(86,140,214,.6)' : 'rgba(86,140,214,.3)'; c.fillRect(x, y, k, 1);
  }
  function ciz() {
    for (let i = 0; i < S.g.length; i++) hucre(i);
    const c = S.cv.getContext('2d');
    c.fillStyle = 'rgba(74,74,74,.6)'; c.fillRect(S.en * S.k - 1, 0, 1, S.boy * S.k); c.fillRect(0, S.boy * S.k - 1, S.en * S.k, 1);
  }

  function kontrol() {
    const durum = $('kendi-durum'), n = S.en * S.boy, dolu = S.g.reduce((a, v) => a + (v ? 1 : 0), 0);
    if (dolu < 3) { durum.textContent = 'Önce birkaç kare boya.'; return null; }
    const cozum = Uint8Array.from(S.g, v => (v ? 1 : 0));
    const b = KK.model.bulmacaYap({ id: 'kendi', en: S.en, boy: S.boy, cozum });
    const hedef = S.en <= 5 ? 'kolay' : S.en <= 10 ? 'orta' : 'zor';
    const t = KK.solver.tekillik(b, { dugumButcesi: 40000 });
    let bas = [], bant;
    if (t.sonuc === 'tek') { const d = KK.difficulty.derece(b, { sinir: hedef }); bant = d.bant; }
    if (t.sonuc !== 'tek' || bant === 'tahmin') {
      const o = KK.difficulty.baslangicOner(b, { hedefBant: hedef, enCok: Math.ceil(n * .12) });
      if (!o) { durum.textContent = 'Bu resim mantıkla çözülemiyor; birkaç kareyi değiştir.'; S.sonuc = null; return null; }
      bas = o.baslangic; bant = o.derece.bant;
    }
    S.sonuc = { bas, bant };
    durum.textContent = `Tek çözümlü · ${bant}${bas.length ? ` · ${bas.length} başlangıç karesi otomatik eklendi` : ''}.`;
    KK.sayfa.duyur(durum.textContent);
    return S.sonuc;
  }
  function kod() {
    const s = S.sonuc || kontrol();
    if (!s) return null;
    return KK.model.koduYaz(S.en, S.boy, S.g, s.bas);
  }
  function dene() {
    const k = kod();
    if (!k) return;
    kaydet();
    KK.oyun.ac(resimden(k, $('kendi-ad').value || 'Resmim', $('kendi-cizen').value), { temiz: true });
  }
  async function paylas() {
    const k = kod();
    if (!k) return;
    kaydet();
    const p = new URLSearchParams({ kendi: k });
    if ($('kendi-ad').value) p.set('ad', $('kendi-ad').value);
    if ($('kendi-cizen').value) p.set('cizen', $('kendi-cizen').value);
    const url = location.href.split('#')[0] + '#' + p.toString();
    const ta = $('kendi-link'); ta.value = url; ta.hidden = false; ta.select();
    const s = await Kit.bulmaca.gunluk.paylas(`Kare Karalamaca · benim resmim: ${url}`);
    $('kendi-durum').textContent = s === 'pano' ? 'Bağlantı panoya kopyalandı.' : s === 'share' ? 'Paylaşıldı.' : 'Bağlantıyı kopyala ve gönder.';
  }

  KK.kendi = Object.assign(S, { ac, resimden, kontrol });
})();
