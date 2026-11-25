// Hangarda uçağa dokununca açılan fiş (ui/kart.js kabuğu): kimlik, mekân rekorları, mizaç; Uçur, Boya/Ayar, Ütüle, Emekli et.
import { duelloOku, duelloYaz } from './duelloDurum.js';
import { SOZLUK as SZ } from './sozluk.js';
import { el, dugme, cerceveleriCiz, svgKatman, dugmeDurum } from './sayfa.js';
import { kartAc } from './kart.js';
import { sahneRekorlari } from '../engine/pilot.js';
import { ucakCiz } from './ucakCiz.js';
import { mizac, utule, UTU_HAKKI } from '../engine/hangar.js';
import { KAMERALAR } from '../engine/poz.js';
import { ucusRotasi } from '../engine/akis.js';

const sayi = (v, b = 1) => Number(v || 0).toFixed(b).replace('.', ',');

// o: { ucak, tasarim, katlama, depo, git, kapandi(degisti) }
export function ucakFisiAc(o) {
  const KL = window.Kit.kalem;
  if (document.querySelector('.perde .ucak-fisi')) return null;       // iki kez açılmasın (tıklama + Enter)
  let u = o.ucak;
  let degisti = false;
  const k = kartAc({ etiket: `${u.ad || 'İsimsiz'} fişi`, sinif: 'fis ucak-fisi', donus: o.donus, kapandi: () => o.kapandi && o.kapandi(degisti) });
  const fis = k.kart;
  const kapat = () => k.kapat('kapat');

  function doldur() { k.doldur(icerik, '#fis-ucur'); }
  function icerik() {
    const h = el('h2', { sinif: 'bolum' }, fis);
    KL.harfle(h, `${u.ad || 'İsimsiz'}${u.emekli ? ' · emekli' : ''}`);
    const alt = el('p', { sinif: 'not' }, fis);
    KL.harfle(alt, `${o.tasarim.ad} (${o.tasarim.orijinalAd}) · ${new Date(u.tarih).toLocaleDateString('tr-TR')} tarihinde katlandı`, { anlik: true });
    const svg = svgKatman(fis, 360, 150, 'fis-ucak');
    ucakCiz(svg, o.katlama, { ucak: u, kamera: KAMERALAR.HANGAR, merkez: [180, 62], olcek: 150, zemin: -0.35 });
    const ist = u.istatistik;
    const satirlar = [
      ['katlama kalitesi', `%${u.kalite} (${{ elle: 'elle', izle: 'izleyerek', karma: 'karma', gelen: 'notla geldi' }[u.mod] || u.mod})`],
      ['uçuş', String(ist.ucus)],
      ['en çok takla', String(ist.loop)],
      ['pencereden kaçış', String(ist.pencere)],
      ['kırışık', `${u.yipranma.kirisik}${u.yipranma.kirisik > 10 ? ' (uçuşu bozuyor)' : ''} · ütü hakkı ${UTU_HAKKI - u.yipranma.utu}`],
    ];
    if (u.gercek && u.gercek.length) {
      const enIyi = Math.max(...u.gercek.map(g => g.mesafe));
      satirlar.push(['gerçekte', `${u.gercek.length} atış, en uzak ${sayi(enIyi)} m (defterde ${sayi(ist.enUzak)} m)`]);
    }
    const dl = el('dl', { sinif: 'fis-satirlar' }, fis);
    for (const [ad, deger] of satirlar) {
      KL.harfle(el('dt', {}, dl), ad, { anlik: true });
      KL.harfle(el('dd', {}, dl), deger, { anlik: true });
    }
    // her mekânda en uzak ve en uzun (yalnız uçulan mekânlar)
    const rekorlar = sahneRekorlari(u);
    if (rekorlar.length) {
      KL.harfle(el('p', { sinif: 'not' }, fis), 'Mekân rekorları:', { anlik: true });
      const sr = el('dl', { sinif: 'fis-satirlar ucak-sahne-rekorlari' }, fis);
      for (const r of rekorlar) {
        KL.harfle(el('dt', {}, sr), r.ad.toLowerCase(), { anlik: true });
        KL.harfle(el('dd', {}, sr), `${sayi(r.enUzak)} m · ${sayi(r.enUzun)} s · ${r.ucus} uçuş`, { anlik: true });
      }
    }
    const m = el('p', { sinif: 'mizac' }, fis);
    KL.harfle(m, `Mizacı: ${mizac(u)}`, { tohum: ['mizac', u.id] });
    if (u.eskiModel) {
      const e = el('p', { sinif: 'not kirmizi eski-kalip' }, fis);
      KL.harfle(e, `Bu uçak ${o.tasarim.ad} tasarımının eski kalıbıyla katlanmıştı; artık aslına uygun yeni kalıpla görünüyor. `
        + (u.eskiBoya ? 'Eski boyası saklandı ama yeni kanatlara oturmuyor; Boya/Ayar ile yeniden boyayabilirsin.' : 'Uçuşları ve rekorları yerinde.'), { anlik: true });
    }
    if (u.not) {
      const n = el('p', { sinif: 'not mavi' }, fis);
      KL.harfle(n, `İçindeki not: “${u.not.metin}”${u.not.gonderen ? ` — ${u.not.gonderen}` : ''}`, { anlik: true });
    }
    if (!u.emekli) {
      // dijital ikiz: gerçekte atılan mesafe elle girilir
      const ikiz = el('div', { sinif: 'satir-alan' }, fis);
      KL.harfle(el('label', { sinif: 'etiket', for: 'gercek-mesafe' }, ikiz), 'Gerçek atış (m):', { anlik: true });
      const g = el('input', { id: 'gercek-mesafe', type: 'text', inputmode: 'decimal', pattern: '[0-9]+([.,][0-9]+)?', placeholder: '7,5', sinif: 'imza-girdi sayi-girdi', autocomplete: 'off' }, ikiz);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') ikiz.querySelector('#gercek-ekle').click(); });
      dugme(ikiz, { id: 'gercek-ekle', yazi: SZ.yan.deftereIsle, sinif: 'kucuk', tik: () => {
        const v = Number(String(g.value).trim().replace(',', '.'));
        const yeni = o.depo.gercekEkle(u.id, v);
        if (!yeni) { g.focus(); return; }
        u = yeni; degisti = true; doldur();
      } });
    }

    const nav = el('nav', { sinif: 'dugmeler' }, fis);
    if (!u.emekli) {
      dugme(nav, { id: 'fis-ucur', yazi: 'Uçur →', href: ucusRotasi(u.id, o.depo.ayarlar()), onem: 'birincil', tik: () => kapat() });
      dugme(nav, { id: 'fis-boya', yazi: SZ.yan.adlandir, href: `#/adlandir/${u.id}`, tik: () => kapat() });
      const utuD = dugme(nav, { id: 'fis-utu', yazi: 'Ütüle', tik: () => {
        const y = utule(u.yipranma);
        if (!y) return;
        u = o.depo.ucakGuncelle(u.id, { yipranma: y }) || u;
        window.Kit.ses.cal('hisirti');
        degisti = true;
        doldur();
      } });
      const emekliD = dugme(nav, { id: 'fis-emekli', yazi: SZ.tehlikeli.emekli, tehlikeli: true, tik: () => emekliSor() });
      requestAnimationFrame(() => {
        dugmeDurum(utuD, !!utule(u.yipranma));
        void emekliD;
      });
    }
    dugme(nav, { id: 'fis-yazdir', yazi: 'Yazdır', href: `#/yazdir/${u.id}`, tik: () => kapat() });
    if (!u.emekli) dugme(nav, { id: 'fis-not', yazi: 'Notla gönder', href: `#/notla/${u.id}`, tik: () => kapat() });
    dugme(nav, { id: 'fis-sil', yazi: SZ.tehlikeli.sil, onem: 'ucuncul', tehlikeli: true, tik: () => silSor() });
    dugme(nav, { id: 'fis-kapat', yazi: 'Kapat', onem: 'ucuncul', tik: () => kapat() });
    const soru = el('div', { sinif: 'emekli-sorusu', hidden: true }, fis);

    // Silmek geri alınamaz: uçak, uçuş günlüğü ve rekorları gider (pilot kartı da yeniden hesaplanır).
    function silSor() {
      soru.hidden = false;
      soru.textContent = '';
      const p = el('p', { sinif: 'not kirmizi' }, soru);
      KL.harfle(p, `${u.ad || 'İsimsiz'} silinsin mi? Uçuşları ve rekorları da gider; bu geri alınamaz. İstersen emekli edip müzeye asabilirsin.`, { anlik: true });
      const s = el('nav', { sinif: 'dugmeler' }, soru);
      dugme(s, { id: 'sil-evet', yazi: SZ.tehlikeli.silEvet, tehlikeli: true, tik: () => {
        o.depo.ucakSil(u.id);
        const d = duelloOku();
        if (d && d.oyuncular.some(x => x.ucakId === u.id)) duelloYaz(null);   // süren düello o uçağa bağlıydı
        degisti = true;
        kapat();
      } });
      dugme(s, { id: 'sil-hayir', yazi: SZ.yan.vazgec, tik: () => { soru.hidden = true; } });
      requestAnimationFrame(() => { cerceveleriCiz(soru, true); soru.querySelector('#sil-hayir').focus(); });
    }

    function emekliSor() {
      soru.hidden = false;
      soru.textContent = '';
      const p = el('p', { sinif: 'not mavi' }, soru);
      KL.harfle(p, 'Müze duvarına asılsın mı? Emekli uçak bir daha uçmaz.', { anlik: true });
      const s = el('nav', { sinif: 'dugmeler' }, soru);
      dugme(s, { id: 'emekli-evet', yazi: SZ.tehlikeli.emekliEvet, tehlikeli: true, tik: () => {
        u = o.depo.ucakGuncelle(u.id, { emekli: true }) || u;
        degisti = true;
        kapat();
      } });
      dugme(s, { id: 'emekli-hayir', yazi: SZ.yan.vazgec, tik: () => { soru.hidden = true; } });
      requestAnimationFrame(() => { cerceveleriCiz(soru, true); soru.querySelector('#emekli-hayir').focus(); });
    }
  }
  doldur();
  return { kapat };
}
