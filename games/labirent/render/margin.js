// render/margin.js — sayfanın üst ve alt boşluğu (marj): gümüş jel kalemle başlık, mod satırı, künye, kronometre,
// sonuç satırları, altı çizili komut sözcükleri ve ses simgesi. DOM + kit (harfle, dugmeAltiCiz). Kutu düğme yok.
// Henüz açılmayan komutlar soluk durur (disabled).
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const $ = (id) => document.getElementById(id);
  const KL = () => window.Kit.kalem;
  const BEYAZ = '#f1eee6', GUMUS = '#b3b2ad';

  function sozcuk(kap, id, yazi, veri) {
    const b = document.createElement('button');
    b.className = 'dugme sozcuk';
    b.type = 'button';
    if (id) b.id = id;
    if (veri) for (const k in veri) b.dataset[k] = veri[k];
    const s = document.createElement('span');
    s.className = 'yazi';
    b.appendChild(s);
    kap.appendChild(b);
    KL().harfle(s, yazi, { tohum: [id || yazi], anlik: true });
    b.addEventListener('pointerenter', () => { if (!b.disabled) KL().dugmeAltiVurgu(b); });
    return b;
  }

  // Altı çizgiler: etkin sözcük beyaz ve biraz kalın; devre dışı sözcüğün altı çizilmez
  function altCiz(b, anlik = true) {
    if (b.hidden) return;
    if (b.disabled) { const s = b.querySelector(':scope > svg.cerceve'); if (s) s.remove(); return; }
    const etkin = b.classList.contains('etkin');
    KL().dugmeAltiCiz(b, 0, anlik, { stroke: etkin ? BEYAZ : GUMUS, strokeWidth: etkin ? 1.7 : 1.45 });
  }
  function altlariCiz(kap = document) { kap.querySelectorAll('.dugme.sozcuk').forEach(b => altCiz(b)); }

  function etkin(b, deger) { b.classList.toggle('etkin', !!deger); b.setAttribute('aria-pressed', String(!!deger)); altCiz(b); }

  function kur(o) {
    const C = LB.config;
    KL().harfle($('baslik'), 'Labirent', { tohum: ['baslik'], anlik: true });
    const modlar = $('modlar');
    C.modlar.forEach(([ad, yazi], i) => {
      if (i) { const n = document.createElement('span'); n.className = 'ara gumus'; n.setAttribute('aria-hidden', 'true'); n.textContent = '·'; modlar.appendChild(n); }
      const b = sozcuk(modlar, 'm-' + ad, yazi, { mod: ad });
      if (ad === o.mod) b.classList.add('etkin');
      if (o.kapali && o.kapali.includes(ad)) { b.disabled = true; b.title = 'yakında'; }
    });
    const komut = $('komutlar');
    // bitişten sonra beliren komutlar (moda göre): baştadır, gizli başlar
    (o.sonra || []).forEach(([ad, yazi]) => { const b = sozcuk(komut, 'k-' + ad, yazi); b.hidden = true; b.classList.add('sonra'); });
    C.komutlar.forEach(([ad, yazi]) => {
      const b = sozcuk(komut, 'k-' + ad, yazi);
      if (o.kapali && o.kapali.includes(ad)) { b.disabled = true; b.title = 'yakında'; }
    });
    const ses = document.createElement('button');
    ses.className = 'dugme ikon';
    ses.id = 'k-ses';
    ses.type = 'button';
    ses.setAttribute('aria-label', 'Ses');
    ses.innerHTML = '<svg class="ses-simge" viewBox="0 0 40 40" aria-hidden="true"></svg>';
    komut.appendChild(ses);
    sesCiz();
    altlariCiz();
  }

  function sesCiz() {
    const b = $('k-ses'), acik = !window.Kit.ses.sessiz;
    b.setAttribute('aria-pressed', String(acik));
    KL().sesSimgesiCiz(b.querySelector('svg'), acik, true);
  }

  function kunye(metin) { KL().harfle($('kunye'), metin, { tohum: ['kunye', metin], anlik: true }); }

  // Saniye → "0:42"; işaretli fark → "−0:13" / "+0:08"
  const sureYaz = (sn) => { const t = Math.max(0, Math.floor(sn)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const farkYaz = (sn) => (sn < 0 ? '−' : '+') + sureYaz(Math.abs(sn));

  let sonSure = null;
  function kronometre(sn) {
    const metin = sureYaz(sn);
    if (metin === sonSure) return;
    sonSure = metin;
    const el = $('kronometre'), yazi = el.querySelector('.yazi');
    KL().harfle(yazi, metin, { tohum: ['sure'], anlik: true });
    el.setAttribute('aria-label', 'Süre ' + metin);
  }

  // Bitişte süre yolun renginde, simli bir çemberin içine alınır
  function cember(renk) {
    const el = $('kronometre');
    cemberSil();
    const w = el.offsetWidth, h = el.offsetHeight, yazi = el.querySelector('.yazi'), bb = yazi.getBoundingClientRect(), kb = el.getBoundingClientRect();
    const olcek = kb.width ? w / kb.width : 1;
    const cx = (bb.left - kb.left + bb.width / 2) * olcek, cy = (bb.top - kb.top + bb.height / 2) * olcek;
    const svg = KL().svgEl('svg', { class: 'cember', 'aria-hidden': 'true', width: w, height: h, viewBox: `0 0 ${w} ${h}` });
    el.appendChild(svg);
    const K = KL().kalemYap(svg);
    const s = K.elips(svg, [cx, cy, bb.width * olcek + 26, bb.height * olcek + 14], { stroke: renk, strokeWidth: 2.2, roughness: 1.1, disableMultiStroke: false }, ['cember', Date.now() % 97], { sureMs: [420, 420] });
    s.bitti.then(() => s.node.querySelectorAll('path').forEach((p, i) => window.Kit.jel.simSvg(p, renk, ['cember', i], 2.2)));
  }
  function cemberSil() { const s = $('kronometre').querySelector('svg.cember'); if (s) s.remove(); }

  // satirlar: [[{ metin, sinif }], …] — her satır bir <p>, her parça harf harf
  function sonuc(satirlar) {
    const el = $('sonuc');
    el.textContent = '';
    el.classList.toggle('bos', !satirlar);
    if (!satirlar) return;
    satirlar.forEach((parcalar, i) => {
      const p = document.createElement('p');
      p.className = 'sonuc-satir';
      parcalar.forEach(({ metin, sinif }, j) => {
        if (j) { const a = document.createElement('span'); a.className = 'ara'; a.textContent = ' · '; p.appendChild(a); }
        const s = document.createElement('span');
        s.className = sinif || 'gumus';
        p.appendChild(s);
        KL().harfle(s, metin, { tohum: ['sonuc', i, j, metin], gecikme: 250 + (i * 3 + j) * 120 });
      });
      el.appendChild(p);
    });
  }

  LB.marj = { kur, sozcuk, altCiz, altlariCiz, etkin, kunye, kronometre, cember, cemberSil, sonuc, sesCiz, sureYaz, farkYaz, yenile: () => altlariCiz() };
})();
