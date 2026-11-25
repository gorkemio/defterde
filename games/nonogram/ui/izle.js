// ui/izle.js — İzle: bilgisayar bulmacayı adım adım, açıklamalarıyla çözer (merdiven: en basit kural önce). Duraklat, ileri,
// geri, hız. Öğretici kolay bir resimde başlar; her bulmacada açılabilir. İzlenen resim çözülmüş sayılmaz.
(function () {
  'use strict';
  const KK = window.KK;
  const $ = (id) => document.getElementById(id);
  const S = { adimlar: [], i: 0, oynuyor: false, hiz: 1, zaman: 0, gecmis: [], resim: null };
  const HIZLAR = [1, 2, 4, .5];

  function ac(resim) {
    KK.oyun.ac(resim, { izle: true, temiz: true });
    S.resim = resim;
    const b = KK.oyun.b, d0 = KK.difficulty.baslangicDurumu(b);
    S.adimlar = KK.difficulty.merdiven.cozumKaydi(d0, b).adimlar;
    S.i = 0; S.gecmis = []; S.oynuyor = true;
    $('izle-not').hidden = false;
    yaz(`${S.adimlar.length} adımda çözülecek. Her adımda en basit kural aranır; çerçeveli satır ya da sütuna bak.`);
    KK.sayfa.cizgileriCiz(false);
    dugmeler();
    S.zaman = setTimeout(sonraki, 1600);
  }
  function yaz(m) { $('izle-metin').textContent = m; KK.sayfa.duyur(m); }
  function sure() { return Math.max(350, 2200 / S.hiz); }

  function uygula(a) {
    const O = KK.oyun, b = O.b, eski = [];
    for (const h of a.hucreler) { const i = h.r * b.en + h.c; eski.push([i, O.d[i]]); O.koyHam(i, h.v); }
    S.gecmis.push(eski);
    KK.ust.ipucu = Object.assign({ bas: performance.now() }, a.bolge);
    KK.ust.izleKareler = a.hucreler;
    KK.zemin.vurgula(a.bolge.tur === 'kare' ? null : a.bolge);
    const h = a.hucreler[0];
    if (h) {
      const t = KK.tahta, D = t.donusum(), bb = t.G.b * t.kam.s, x = t.kam.tx + (h.c + .5) * bb, y = t.kam.ty + (h.r + .5) * bb;
      if (x < D.gx0 || x > t.w || y < D.gy0 || y > t.h) t.odakla([(h.c + .5) * t.G.b, (h.r + .5) * t.G.b], false);
    }
    O.ustuGuncelle();
    O.ses(a.hucreler.some(x => x.v === 1) ? 'tarama' : 'carpi');
    yaz(`${S.i + 1}/${S.adimlar.length} · ${KK.explain.aciklama(a)}`);
    KK.tahta.kirli();
  }
  function sonraki() {
    clearTimeout(S.zaman);
    if (S.i >= S.adimlar.length) return bitir();
    uygula(S.adimlar[S.i]);
    S.i++;
    if (S.oynuyor) S.zaman = setTimeout(sonraki, sure());
  }
  function onceki() {
    clearTimeout(S.zaman);
    S.oynuyor = false; dugmeler();
    const eski = S.gecmis.pop();
    if (!eski) return;
    S.i--;
    for (const [i, v] of eski.reverse()) KK.oyun.koyHam(i, v, { anim: false });
    KK.oyun.ustuGuncelle();
    const a = S.adimlar[S.i - 1];
    if (a) { KK.ust.ipucu = Object.assign({ bas: performance.now() }, a.bolge); KK.ust.izleKareler = a.hucreler; yaz(`${S.i}/${S.adimlar.length} · ${KK.explain.aciklama(a)}`); }
    else { KK.ust.ipucu = null; KK.ust.izleKareler = null; yaz('Başa dönüldü.'); }
    KK.tahta.kirli();
  }
  function bitir() {
    clearTimeout(S.zaman);
    S.oynuyor = false;
    KK.ust.ipucu = null; KK.ust.izleKareler = null; KK.zemin.vurgula(null);
    $('izle-not').hidden = true;
    const O = KK.oyun;
    if (KK.model.cozulduMu(O.d, O.b)) {
      O.bitti = true;
      KK.bitis.baslat({ sure: 0, hata: 0, ipucu: 0, mod: 'izle' });
    }
  }
  function durdur() { clearTimeout(S.zaman); S.oynuyor = false; $('izle-not').hidden = true; KK.ust.izleKareler = null; }
  function dugmeler() {
    $('i-oynat').querySelector('.yazi').textContent = S.oynuyor ? 'duraklat' : 'oynat';
    $('i-hiz').querySelector('.yazi').textContent = `hız ×${S.hiz === .5 ? '½' : S.hiz}`;
    requestAnimationFrame(() => document.querySelectorAll('#izle-not .dugme').forEach(b => Kit.kalem.dugmeAltiCiz(b, 0, true)));
  }

  // Öğretici: 10×10 kolay resimlerden en çok adımlısı (tekniklerin hepsi görünsün)
  function ogretici() {
    const kat = KK.resimler.yukle();
    const aday = kat.tum.filter(r => r.en === 10 && r.boy === 10 && r.bant === 'kolay').sort((a, b) => b.puan - a.puan)[0] || kat.tum[0];
    ac(aday);
  }

  function kur() {
    $('i-oynat').addEventListener('click', () => { S.oynuyor = !S.oynuyor; dugmeler(); if (S.oynuyor) sonraki(); else clearTimeout(S.zaman); });
    $('i-ileri').addEventListener('click', () => { S.oynuyor = false; dugmeler(); sonraki(); });
    $('i-geri').addEventListener('click', onceki);
    $('i-hiz').addEventListener('click', () => { S.hiz = HIZLAR[(HIZLAR.indexOf(S.hiz) + 1) % HIZLAR.length]; dugmeler(); });
    $('i-bitir').addEventListener('click', () => { durdur(); KK.oyun.ac(S.resim, { temiz: false }); });
  }
  document.addEventListener('DOMContentLoaded', kur);
  if (document.readyState !== 'loading') kur();

  KK.izle = Object.assign(S, { ac, ogretici, durdur, sonraki, onceki });
})();
