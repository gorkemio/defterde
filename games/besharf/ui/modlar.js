// ui/modlar.js — modlar: Günün kelimesi (açılış), Serbest, Düello, Arkadaşına kelime gönder, İki kişi aynı cihaz.
// Veri burada bir kez hazırlanır (cevaplar çözülür, tahmin kümesi, anlamlar); çözücü ilk gereken anda kurulur.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const D = () => BH.daily, G = () => BH.game;
  const veri = {};
  let cozucu = null, aktif = null;

  function hazirla() {
    const V = BH.veri;
    veri.cevaplar = D().cozCevaplar(V.cevaplar);
    veri.tahminler = V.tahminler.liste.split('\n');
    veri.onerilmez = V.tahminler.onerilmez ? V.tahminler.onerilmez.split('\n') : [];
    veri.kume = new Set(veri.tahminler);
    veri.anlam = new Map(veri.cevaplar.map((k, i) => [k, V.anlamlar.liste[i]]));
    veri.oneriler = V.oneriler || null;
    return veri;
  }

  function solver() {
    if (!cozucu) cozucu = BH.solver.kur({ tahminler: veri.tahminler, cevaplar: veri.cevaplar, oneriler: veri.oneriler,
      onerilmez: veri.onerilmez, havuz: BH.config.havuz });
    return cozucu;
  }

  // Etkin modu işaretler; günlük dışındaki modlarda kâğıdın sol üstünde "‹ günün kelimesi" dönüşü
  function modAyarla(ad) {
    aktif = ad;
    document.body.dataset.mod = ad;
    const b = document.getElementById('k-gunun');
    if (!b) return;
    b.hidden = ad === 'gunun';
    if (!b.hidden) {
      const y = b.querySelector('.yazi');
      Kit.daktilo.metin(y, y.dataset.metin || y.textContent.trim(), { anlik: true, tohum: ['komut', 'k-gunun'] });
      requestAnimationFrame(() => Kit.kalem.dugmeAltiCiz(b, 0, true));
    }
  }

  // Serbest ve düello için cevaplardan rastgele: son 500 cevap (bh-gecmis) tekrar gelmez
  function rastgeleCevap(rng = Math.random) {
    const gecmis = new Set(BH.depo.oku('gecmis', []) || []);
    const bugun = D().gununCevabi(veri.cevaplar).kelime;
    let havuz = veri.cevaplar.filter((k) => !gecmis.has(k) && k !== bugun);
    if (!havuz.length) havuz = veri.cevaplar.filter((k) => k !== bugun);
    const k = havuz[Math.floor(rng() * havuz.length)];
    const yeni = (BH.depo.oku('gecmis', []) || []).concat([k]).slice(-BH.config.gecmis);
    BH.depo.yaz('gecmis', yeni);
    return k;
  }

  /* ---------- Günün kelimesi ---------- */

  function gunun() {
    BH.sonuc.durdur();
    const bugun = D().istanbulTarih();
    const g = D().gununCevabi(veri.cevaplar, bugun);
    const kayit = BH.depo.oku('gun');
    let d = kayit && kayit.tarih === bugun ? G().yukle(kayit.durum) : null;
    if (!d || d.cevap !== g.kelime) d = G().yeni({ mod: 'gunun', cevap: g.kelime, no: g.no, tarih: bugun, zor: BH.depo.ayar().zor });
    modAyarla('gunun');
    BH.akis.kur({
      durum: d, kume: veri.kume, baslik: 'BEŞ HARF', alt: `No. ${g.no} · ${D().tarihYazi(bugun)}`, tohum: ['gun', bugun],
      kaydet: (x) => BH.depo.yaz('gun', { tarih: bugun, durum: x }),
      bitince: (x, o) => BH.sonuc.bitir(x, Object.assign({}, o, { anlam: veri.anlam.get(x.cevap), gunun: true,
        yeniGun: () => { if (aktif === 'gunun') gunun(); } })),
    });
    BH.sahne.duyur(`Beş Harf No. ${g.no}. ${d.tahminler.length ? d.tahminler.length + ' tahmin yapılmış.' : 'Altı tahmin hakkın var.'}`);
  }

  /* ---------- tek kelimelik modlar: serbest, arkadaş, iki kişi ---------- */

  // o: { mod, cevap, baslik, alt, komutlar(d) → [[metin, fn, id]] } — oyun bitince komutlar kâğıdın dibine basılır
  function tekOyun(o) {
    BH.sonuc.durdur();
    modAyarla(o.mod);
    const d = G().yeni({ mod: o.mod, cevap: o.cevap, zor: BH.depo.ayar().zor });
    BH.akis.kur({
      durum: d, kume: veri.kume, baslik: o.baslik, alt: o.alt, tohum: [o.mod, o.cevap],
      bitince: (x, b) => BH.sonuc.bitir(x, { anlik: b.anlik, anlam: veri.anlam.get(x.cevap) || null,
        komutlar: o.komutlar ? o.komutlar(x) : [] }),
    });
  }

  // Serbest komutu: üç seçenekli küçük fiş
  function serbestNotu() {
    BH.not.ac({
      baslik: 'Serbest',
      ciz(ic, y) {
        y.satir('Günün kelimesinden bağımsız oyunlar; seriye ve istatistiğe sayılmaz.');
        const satir = (metin, aciklama, fn, id) => {
          const p = document.createElement('p'); p.className = 'not-komut secim'; ic.appendChild(p);
          y.komut(metin, () => { BH.not.kapat(); fn(); }, id, { kap: p });
          y.satir(aciklama, { kap: p, etiket: 'span', sinif: 'secim-aciklama' });
        };
        satir('Rastgele kelime', 'listeden, son 500 cevap dışında', serbest, 'se-rastgele');
        satir('Arkadaşına gönder', 'bir kelime yaz, link oluşsun', arkadasNotu, 'se-arkadas');
        satir('İki kişi', 'aynı cihazda: biri yazar, öbürü bulur', ikiKisi, 'se-iki');
      },
    });
  }

  function serbest() {
    const cevap = rastgeleCevap();
    tekOyun({ mod: 'serbest', cevap, baslik: 'SERBEST', alt: D().tarihYazi(D().istanbulTarih()), komutlar: () => [
      ['Yeni kelime', serbest, 'se-yeni'], ['Analiz', () => BH.analiz.ac(), 'se-analiz'],
    ] });
  }

  // Gizli kelime alanı: yalnız 29 harf, en çok 5, büyük harf (tr-TR); göster/gizle
  function kelimeAlani(ic, y, o = {}) {
    const p = document.createElement('p'); p.className = 'not-satir giris-satir'; ic.appendChild(p);
    const g = document.createElement('input');
    g.className = 'daktilo-giris';
    g.type = o.gizli ? 'password' : 'text';
    g.maxLength = 5;
    g.autocomplete = 'off'; g.spellcheck = false;
    g.setAttribute('autocapitalize', 'characters');
    g.setAttribute('aria-label', o.etiket || 'Beş harfli kelime');
    g.addEventListener('input', () => {
      const t = Array.from(Kit.tr.normalize(g.value)).filter((c) => Kit.tr.ALFABE.includes(c)).slice(0, 5).join('');
      if (t !== g.value) g.value = t;
    });
    p.appendChild(g);
    if (o.gizli) y.komut('göster', (e) => { g.type = g.type === 'password' ? 'text' : 'password'; }, 'giris-goster', { kap: p });
    const hata = document.createElement('p'); hata.className = 'not-satir fis-durum'; hata.setAttribute('role', 'status'); ic.appendChild(hata);
    const dene = () => {
      const k = Kit.tr.normalize(g.value);
      const mesaj = Array.from(k).length !== 5 ? 'Beş harf gerekli.' : !veri.kume.has(k) ? 'Bu kelime listede yok.' : null;
      if (mesaj) { Kit.daktilo.metin(hata, mesaj, { anlik: true, tohum: ['hata', mesaj] }); g.focus(); return null; }
      return k;
    };
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' && o.enter) { e.preventDefault(); o.enter(); } });
    return { girdi: g, dene };
  }

  function arkadasNotu() {
    let alan = null;
    BH.not.ac({
      baslik: 'Arkadaşına gönder',
      ciz(ic, y) {
        y.satir('Beş harfli bir kelime yaz (tahmin listesinde olmalı). Link oluşur; açan kişi o kelimeyi oynar.');
        const olustur = () => {
          const k = alan.dene();
          if (!k) return;
          const url = location.href.replace(/#.*$/, '') + '#k=' + G().linkKodla(k);
          linkKutusu.textContent = url;
          linkKutusu.hidden = false;
          BH.sonuc.paylas(null, durum, 'Beş Harf: sana bir kelime gönderdim, bulabilir misin? ' + url);
        };
        alan = kelimeAlani(ic, y, { gizli: true, enter: olustur, etiket: 'Gönderilecek kelime' });
        const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
        y.komut('Link oluştur', olustur, 'ar-olustur', { kap: p });
        const linkKutusu = document.createElement('p'); linkKutusu.className = 'not-satir link-kutusu'; linkKutusu.hidden = true; ic.appendChild(linkKutusu);
        const durum = document.createElement('p'); durum.className = 'not-satir fis-durum'; durum.setAttribute('role', 'status'); ic.appendChild(durum);
      },
      sonra: () => alan && alan.girdi.focus(),
    });
  }

  // Linkle gelen kelime: kendi başlığıyla oynanır; sonuç geri paylaşılabilir
  function arkadas(kelime) {
    tekOyun({ mod: 'arkadas', cevap: kelime, baslik: 'BEŞ HARF', alt: 'arkadaşından bir kelime', komutlar: (d) => [
      ['Sonucu paylaş', () => BH.sonuc.paylas(d), 'ar-paylas'], ['Günlük', gunun, 'ar-gunun'],
    ] });
  }

  // İki kişi aynı cihaz: devir notları ("telefonu arkadaşına ver") arasında gizli kelime girişi
  function devir(baslik, metin, sonra) {
    BH.not.ac({ baslik, geriYok: true, ciz(ic, y) {
      y.satir(metin);
      const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
      y.komut('hazırım', () => { BH.not.kapat(); sonra(); }, 'iki-hazir', { kap: p });
      y.komut('vazgeç', () => BH.not.kapat(), 'iki-vazgec', { kap: p });
    } });
  }

  function ikiKisi(sira = 1) {
    const yazan = sira, bulan = sira === 1 ? 2 : 1;
    devir('İki kişi', `${yazan}. oyuncu gizli kelimeyi yazacak. Telefonu ona ver; ${bulan}. oyuncu bakmasın.`, () => {
      let alan = null;
      const tamam = () => {
        const k = alan.dene();
        if (!k) return;
        BH.not.kapat();
        devir('Telefonu arkadaşına ver', `Kelime hazır. Şimdi telefonu ${bulan}. oyuncuya ver.`, () => tekOyun({
          mod: 'ikiKisi', cevap: k, baslik: 'İKİ KİŞİ', alt: `${bulan}. oyuncu buluyor`, komutlar: () => [
            ['Sıra değişsin', () => ikiKisi(bulan), 'iki-degis'], ['Günlük', gunun, 'iki-gunun'],
          ],
        }));
      };
      BH.not.ac({ baslik: 'Gizli kelime', ciz(ic, y) {
        y.satir(`${yazan}. oyuncu: beş harfli bir kelime yaz (listede olmalı).`);
        alan = kelimeAlani(ic, y, { gizli: true, enter: tamam, etiket: 'Gizli kelime' });
        const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
        y.komut('Tamam', tamam, 'iki-tamam', { kap: p });
      }, sonra: () => alan && alan.girdi.focus() });
    });
  }

  // Açılış: #k=… arkadaş linki varsa o kelime, yoksa günün kelimesi
  function baslangic() {
    const e = location.hash.match(/^#k=(.*)$/);
    if (e) {
      const k = G().linkCoz(e[1]);
      if (k && veri.kume.has(k)) { arkadas(k); return; }
      gunun();
      BH.not.ac({ baslik: 'Link bozuk', ciz(ic, y) { y.satir('Bu linkteki kelime okunamadı. Günün kelimesini açtım.'); } });
      return;
    }
    gunun();
    if (!BH.depo.oku('ogretici')) { BH.depo.yaz('ogretici', true); if (BH.ayarlar) setTimeout(() => BH.ayarlar.nasil(), 900); }
  }

  BH.modlar = { hazirla, solver, gunun, veri, modAyarla, rastgeleCevap, serbestNotu, serbest, arkadasNotu, arkadas, ikiKisi,
    baslangic, get aktif() { return aktif; } };
})();
