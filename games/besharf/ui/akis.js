// ui/akis.js — tek bir oyunun kâğıttaki akışı: yazma, silme, gönderme, işaretler, klavye, fiziksel klavye.
// Mod bilmez: ana.js / modlar.js oyunu kurar, kaydetme ve oyun sonu geri çağrılarını verir.
//   BH.akis.kur({ durum, kume, baslik, alt, tohum, kaydet(d), bitince(d, { anlik }) → Promise, satirSonu(d, satir) → Promise,
//                 cizince({ anlik }) — kâğıt baştan çizildikten sonra (düello ızgarası gibi ek çizimler) })
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const G = () => BH.game;
  const ADLAR = { 0: 'kelimede yok', 1: 'başka yerde', 2: 'doğru yerde' };

  let o = null, d = null, giris = [], deneme = [], kilit = false, gecersizSatir = -1, uzanti = null;

  let akisNo = 0; // Bekleyen tahmin animasyonları kurulan yeni oyuna taşınmaz.
  const satirNo = () => d.tahminler.length;
  const aktif = () => o && d && !G().bitti(d) && !kilit && !BH.not.acik;

  function kur(secenek) {
    akisNo++;
    o = secenek;
    d = secenek.durum;
    giris = [];
    deneme = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0]);
    kilit = false;
    gecersizSatir = -1;
    uzanti = null;
    ciz({ anlik: false });
    return d;
  }

  // Durumdan baştan çizer (ilk kurulum ve boyut değişimi). Gönderilmiş satırlar anlık basılır.
  function ciz(so = {}) {
    BH.kagit.kur(document.getElementById('kagit'), { baslik: o.baslik, alt: o.alt, tohum: o.tohum, anlik: so.anlik });
    d.tahminler.forEach((t, r) => {
      Array.from(t.kelime).forEach((h, c) => BH.kagit.harfBas(r, c, h, { anlik: true }));
      BH.kagit.isaretle(r, t.sonuc, { anlik: true });
    });
    if (!G().bitti(d)) giris.forEach((h, c) => BH.kagit.harfBas(satirNo(), c, h, { anlik: true, deneme: deneme[satirNo()][c] }));
    klavyeKur();
    if (o.cizince) o.cizince({ anlik: !!so.anlik });
    if (G().bitti(d)) {
      BH.klavye.gizle(true);
      if (o.bitince) o.bitince(d, { anlik: true });
    } else BH.klavye.gizle(false);
  }

  function klavyeKur() {
    BH.klavye.kur(document.getElementById('klavye'), {
      duzen: BH.depo.ayar().duzen,
      basinca: (h) => harfYaz(h),
      enter: () => gonder(),
      sil: () => sil(),
    });
    for (const [h, durum] of G().tusDurumlari(d.tahminler)) BH.klavye.isaretle(h, durum, { anlik: true });
  }

  function gecersizSil() {
    if (gecersizSatir >= 0) { BH.kagit.gecersizSil(gecersizSatir); gecersizSatir = -1; }
  }

  function harfYaz(h) {
    if (!aktif() || giris.length >= 5) return;
    gecersizSil();
    const r = satirNo(), c = giris.length;
    giris.push(h);
    deneme[r][c]++;
    BH.kagit.harfBas(r, c, h, { deneme: deneme[r][c] });
    BH.ses.cal('vurus');
  }

  function sil() {
    if (!aktif() || !giris.length) return;
    gecersizSil();
    const r = satirNo(), c = giris.length - 1;
    giris.pop();
    BH.kagit.harfSil(r, c, { deneme: deneme[r][c] });
    BH.ses.cal('duzeltici');
  }

  function satirOzeti(t) {
    return t.kelime + ': ' + Array.from(t.kelime).map((h, i) => `${h} ${ADLAR[t.sonuc[i]]}`).join(', ');
  }

  async function gonder() {
    if (!aktif()) return;
    const buAkis = akisNo;
    const r = satirNo();
    if (giris.length < 5) {
      gecersizSil();
      if (giris.length) { BH.kagit.gecersiz(r, 'beş harf'); gecersizSatir = r; }
      BH.sahne.duyur('Beş harf gerekli');
      return;
    }
    BH.ses.cal('kayis');
    BH.ses.cal('zil', 240);
    const s = G().tahminEt(d, giris.join(''), o.kume);
    if (s.hata) {
      const not = s.hata === 'zor' ? s.mesaj : 'listede yok';
      BH.kagit.gecersiz(r, not);
      gecersizSatir = r;
      BH.sahne.duyur(s.hata === 'zor' ? 'Zor mod: ' + s.mesaj : giris.join('') + ' listede yok');
      return;
    }
    kilit = true;
    d = s.durum;
    if (o.kaydet) o.kaydet(d);
    giris = [];
    BH.kagit.lekeSoldur(r);
    const hareket = Kit.kalem.animasyonVar();
    const m = BH.kagit.isaretle(r, s.satir.sonuc, { ses: true, gecikme: hareket ? 120 : 0 });
    if (hareket) await Kit.kalem.bekle(m.sure + 120);
    if (buAkis !== akisNo) return;
    let gec = 0;
    for (const [h, durum] of G().tusDurumlari(d.tahminler)) { BH.klavye.isaretle(h, durum, { gecikme: gec }); gec += 25; }
    BH.sahne.duyur(satirOzeti(s.satir));
    if (o.satirSonu) await o.satirSonu(d, s.satir);
    if (buAkis !== akisNo) return;
    if (G().bitti(d) && o.bitince) await o.bitince(d, { anlik: false });   // tuşları sonuc.bitir kaldırır (kâğıt uzarken)
    if (buAkis === akisNo) kilit = false;
  }

  // Fiziksel klavye: Türkçe ve İngilizce düzende harf, Enter, Backspace
  function tus(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const hedef = e.target;
    if (hedef && hedef.closest && hedef.closest('.defterde-donus')) return;
    if (hedef && (hedef.tagName === 'INPUT' || hedef.tagName === 'TEXTAREA' || hedef.isContentEditable)) return;
    if (BH.not.acik) return;
    if (e.key === 'Enter') {
      if (hedef && hedef.closest && hedef.closest('button') && !hedef.closest('.klavye')) return;   // odaktaki komut
      e.preventDefault(); BH.klavye.bas('enter'); gonder(); return;
    }
    if (e.key === 'Backspace') { e.preventDefault(); BH.klavye.bas('sil'); sil(); return; }
    const h = Kit.tr.tusHarf(e.key);
    if (h) { e.preventDefault(); BH.klavye.bas(h); harfYaz(h); }
  }
  addEventListener('keydown', tus);

  BH.akis = {
    kur, ciz, harfYaz, sil, gonder,
    get durum() { return d; }, get secenek() { return o; }, get giris() { return giris.slice(); },
  };
})();
