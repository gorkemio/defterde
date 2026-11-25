// scripts/filtre.mjs — TDK maddelerini oyun kelimesine çeviren SAF süzgeç.
// Ağ ve dosya yok; hazirla.mjs kullanır, test/filtre.test.mjs sınar.
//
// TDK kaydı (v12): { madde, ozel_mi: "0"|"1", kac, anlamlarListe: [{ anlam_sira, fiil: "0"|"1", anlam,
//   ozelliklerListe: [{ tur: "1" alan | "3" söz türü | "4" kullanım, tam_adi, kisa_adi }] }] }
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const tr = require('../tr.js');

/* ---------- etiketler ---------- */

export const KABA = ['kaba konuşmada', 'hakaret yollu'];                    // herhangi bir anlamda → kelime çıkar
export const ARGO_ANA = ['argo', 'alay yollu'];                              // ana (ilk) anlamda → kelime çıkar
export const ESKI = ['eskimiş', 'ağızlardan', 'halk ağzında'];              // ana anlamda → yalnız "zor"
const SAKINCALI = new Set([...KABA, ...ARGO_ANA]);                           // bu etiketli anlam tanım olarak gösterilmez

// söz türü etiketi → tek harf: a isim · s sıfat · z zarf · ü ünlem · e edat · b bağlaç · m zamir · f fiil
const TUR_HARF = {
  isim: 'a', sıfat: 's', zarf: 'z', ünlem: 'ü', edat: 'e', bağlaç: 'b', zamir: 'm',
  nesnesiz: 'f', '-i': 'f', '-e': 'f', '-de': 'f', '-den': 'f', '-le': 'f', 'yardımcı fiil': 'f',
};

const anlamlar = (m) => (m.anlamlarListe || []).slice().sort((a, b) => Number(a.anlam_sira) - Number(b.anlam_sira));
const etiketler = (a) => new Set((a.ozelliklerListe || []).map((o) => tr.kucult(o.tam_adi || '').replace(/\s+/g, ' ').trim()));
const birinde = (kume, liste) => liste.some((e) => kume.has(e));

/* ---------- söz türü ---------- */

export function turBul(m) {
  const anl = anlamlar(m);
  if (anl.some((a) => a.fiil === '1')) return 'f';
  for (const a of anl) {
    for (const o of a.ozelliklerListe || []) {
      if (o.tur !== '3') continue;
      const t = TUR_HARF[tr.kucult(o.tam_adi || '').replace(/\s+/g, ' ').trim()];
      if (t) return t;
    }
  }
  return '?';     // hiçbir söz türü etiketi yok: çoğunlukla çekim ya da ek kalıntısı ("benden", "gitti"); kolay/orta'ya girmez
}

/* ---------- tanım ---------- */

const ROMEN = '(?:I|II|III|IV|V|VI|VII|VIII|IX|X)';

// Tanım temizliği: ";" sonrasındaki eş anlamlı kuyruk ("; ivedi, evgin, müstacel"), ", X karşıtı" notu ve Latince tür adı
// ("(Pyrus malus)") atılır. Sonra 120 karakteri geçen tanım kelime sınırından kesilir; açık kalan parantez atılır.
export function kisalt(metin, enCok = 120) {
  let t = String(metin).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const nokta = t.indexOf(';');
  if (nokta >= 10) t = t.slice(0, nokta);
  t = t.replace(/\s*\([A-Z][a-z]+ [a-z]+[^)]*\)/g, '').replace(/,\s*[^,;]{1,40}\skarşıtı\s*$/, '').replace(/[:;,]+$/, '').trim();
  // "Kedigillerden, memeli, …" gibi bilimsel sınıf öneki çocuğa bir şey söylemez: atılır, ilk harf büyütülür
  const sinif = t.replace(/^[^\s,]{3,30}(?:lerden|lardan),\s+(?=[a-zçğıöşü])/, '');
  if (sinif !== t && sinif.length >= 12) t = tr.buyut(sinif[0]) + sinif.slice(1);
  if (Array.from(t).length <= enCok) return t;
  t = t.slice(0, enCok - 1);
  t = t.slice(0, Math.max(t.lastIndexOf(' '), 1));
  if (t.split('(').length > t.split(')').length) t = t.slice(0, t.lastIndexOf('(')).trim();
  return t.replace(/[\s,;:(\-–]+$/, '') + '…';
}

// "► okul (I)" → "“okul” sözcüğüyle aynı anlamda"; karmaşık göndermeler (virgül, karşıtı…) kullanılmaz.
export function gondermeMetni(metin) {
  const t = String(metin).replace(/^►\s*/, '').replace(new RegExp('\\s*\\(' + ROMEN + '\\)\\s*', 'g'), ' ').trim();
  if (!t || /[,;()]|karşıtı|bkz/i.test(t)) return null;
  return `“${t}” sözcüğüyle aynı anlamda`;
}

// Çocuğa göre değil uzmana göre yazılmış anlamlar (ör. "amin": kimyada bir bileşik; "bina": Arapça fiil çatısı) ilk anlam olsa da atlanır.
// Somut dünyayı anlatan etiketler (hayvan/bitki bilimi, anatomi, coğrafya, spor) teknik sayılmaz.
const TEKNIK = new Set(['kimya', 'fizik', 'matematik', 'dil bilgisi', 'dil bilimi', 'müzik', 'ticaret', 'hukuk', 'ekonomi', 'felsefe',
  'mantık', 'ruh bilimi', 'toplum bilimi', 'din bilimi', 'din bilgisi', 'bilişim', 'teknik', 'teknoloji', 'jeoloji', 'mineraloji',
  'geometri', 'meteoroloji', 'gök bilimi', 'biyoloji', 'fizyoloji', 'arkeoloji', 'antropoloji', 'mimarlık', 'madencilik', 'edebiyat',
  'eğitim', 'tarih', 'tıp', 'denizcilik', 'askerlik']);
const KISIR = /^\S+(?: \S+)? (?:işi|durumu)$/;                      // "Bakmak işi", "Evli olma durumu": gerçek bir tanım değil

// Tanım seçimi, sırayla: (1) teknik ve kısır olmayan ilk anlam, (2) kısır olmayan ilk anlam, (3) ilk anlam.
// ► göndermeleri ancak başka anlam yoksa kullanılır (gonderme: true); o da yoksa null.
export function anlamSec(m) {
  const adaylar = [];
  let gonderme = null;
  for (const a of anlamlar(m)) {
    const et = etiketler(a);
    if (birinde(et, [...SAKINCALI])) continue;
    const t = String(a.anlam || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (t.startsWith('►')) { gonderme = gonderme || gondermeMetni(t); continue; }
    adaylar.push({ metin: kisalt(t), teknik: birinde(et, [...TEKNIK]), kisir: KISIR.test(t) });
  }
  const secim = adaylar.find((x) => !x.teknik && !x.kisir) || adaylar.find((x) => !x.kisir) || adaylar[0];
  if (secim) return { anlam: secim.metin, gonderme: false };
  return gonderme ? { anlam: kisalt(gonderme), gonderme: true } : null;
}

/* ---------- tek madde ---------- */

// Sonuç: { kabul: true, kayit: { kelime, anlam, gonderme, tur, eski, gizli, kac } }
//      ya da { kabul: false, neden, kelime?, icerik? }
//   icerik: KABA/HAKARET etiketiyle elendi → aynı yazılışlı eş sesli kardeşleri de çıkar. Argo ana anlam ve karaliste yalnız
//   o maddeyi eler (ör. "zil" argo maddesi okul zilini, "mama" argo maddesi bebek mamasını götürmesin).
// secenek.ozelAdIzin: kategori listeleri için (Şehirler gibi özel adlar TDK'da var; büyük harf ve özel ad elenmez)
export function degerlendir(m, { karaliste = new Set(), ozelAdIzin = false, izinli = new Set() } = {}) {
  const madde = String(m.madde || '').trim();
  const ret = (neden, ek = {}) => ({ kabul: false, neden, ...ek });

  if (!ozelAdIzin && String(m.ozel_mi) === '1') return ret('özel ad');
  if (/\s/.test(madde)) return ret('boşluk (çok sözcüklü)');
  if (!madde || /[^\p{L}]/u.test(madde)) return ret('tire, kesme, noktalama, rakam');
  if (!ozelAdIzin && madde !== tr.kucult(madde)) return ret('büyük harfli (kısaltma, simge)');

  const kelime = tr.normalize(madde);
  const harf = Array.from(kelime);
  if (harf.length < 3 || harf.length > 14) return ret('uzunluk (3–14 dışı)');
  if (!harf.every((c) => tr.ALFABE.includes(c))) return ret('alfabe dışı harf (w, x, q, aksanlı)');

  const anl = anlamlar(m);
  const muaf = izinli.has(kelime);                        // izinli.txt: yalnız ikincil anlamı kaba olan masum kelimeler
  if (!muaf && anl.some((a) => birinde(etiketler(a), KABA))) return ret('kaba/hakaret etiketli', { kelime, icerik: true });
  if (!muaf && anl.length && birinde(etiketler(anl[0]), ARGO_ANA)) return ret('argo/alay (ana anlam)', { kelime });
  if (karaliste.has(kelime)) return ret('karaliste', { kelime });

  const secim = anlamSec(m);
  if (!secim) return ret('tanım yok', { kelime });
  const eski = anl.length > 0 && birinde(etiketler(anl[0]), ESKI);
  const gizli = anl.filter((a) => birinde(etiketler(a), [...SAKINCALI])).length;      // argo/alay anlamı gizlenen sayısı
  return { kabul: true, kayit: { kelime, anlam: secim.anlam, gonderme: secim.gonderme, tur: turBul(m), eski, gizli, kac: Number(m.kac) || 0 } };
}

/* ---------- puan ve bant ---------- */

export const SIKLIK_BANDI = (sira) => (sira == null ? 12 : sira <= 5000 ? 0 : sira <= 20000 ? 4 : 8);

// zorluk puanı = 2·uzunluk + farklı harf + nadir harf toplamı + sıklık bandı (küçük = kolay)
export function puanla(kelime, sira) {
  return 2 * tr.harfler(kelime).length + tr.farkliHarf(kelime) + tr.nadirPuan(kelime) + SIKLIK_BANDI(sira);
}

// k kolay · o orta · z zor.
//   kolay: çocuk listesinde (scripts/kaynak/cocuk.mjs) ∧ 4–7 harf ∧ isim/sıfat/fiil ∧ eskimiş değil
//   orta : ilk 20 bin ∧ 3–9 harf ∧ eskimiş değil ∧ söz türü etiketli          (3 harfli kelimeler tahmin etmesi zor, orta'dan başlar)
//   zor  : gerisi (sıklıkta yok, 10+ harf, eskimiş, türü etiketsiz)
// Kolayı sıklık değil liste belirler: OpenSubtitles sıklığı yetişkin diyaloğudur ("tahliye", "ihanet" ilk 5 binde).
export function bantBul({ kelime, sira, tur, eski, cocuk = false }) {
  const n = tr.harfler(kelime).length;
  if (eski || tur === '?') return 'z';
  if (cocuk && n >= 4 && n <= 7 && 'asf'.includes(tur)) return 'k';
  if (sira != null && sira <= 20000 && n >= 3 && n <= 9) return 'o';
  return 'z';
}

/* ---------- tüm sözlük ---------- */

// siklik: Map<normalize kelime, sıra (1'den)>. Fiilde sıra = min(mastar sırası, kök sırası): "gelmek" nadir, "gel" sık.
export function siraBul(kelime, tur, siklik) {
  let sira = siklik.get(kelime) ?? null;
  if (tur === 'f' && /(MAK|MEK)$/.test(kelime) && kelime.length > 4) {
    const kok = siklik.get(kelime.slice(0, -3));
    if (kok != null && (sira == null || kok < sira)) sira = kok;
  }
  return sira;
}

// maddeler: TDK kayıtları. Döner: { kayitlar: [{ kelime, anlam, tur, bant, puan, sira, eski }], elenen: { neden: sayı }, ... }
export function sozlukKur(maddeler, { karaliste = new Set(), siklik = new Map(), izinli = new Set(), cocuk = new Set(), tanimlar = new Map() } = {}) {
  const elenen = {}, ornekler = {};
  const say = (n, k = 1, ornek) => {
    elenen[n] = (elenen[n] || 0) + k;
    if (ornek) { const l = (ornekler[n] ||= []); if (l.length < 10) l.push(ornek); }
  };
  const adaylar = new Map();                 // kelime → [kayit]
  const zehirli = new Set();                 // kaba/hakaret nedeniyle elenen maddenin kelimesi: eş sesli kardeşleri de çıkar
  let kabulMadde = 0;

  for (const m of maddeler) {
    const s = degerlendir(m, { karaliste, izinli });
    if (!s.kabul) { say(s.neden, 1, String(m.madde)); if (s.icerik && s.kelime) zehirli.add(s.kelime); continue; }
    kabulMadde++;
    if (!adaylar.has(s.kayit.kelime)) adaylar.set(s.kayit.kelime, []);
    adaylar.get(s.kayit.kelime).push(s.kayit);
  }

  const kayitlar = [];
  let birlesen = 0, gondermeSiklikYok = 0;
  for (const [kelime, liste] of adaylar) {
    if (zehirli.has(kelime)) { say('eş sesli kardeşi kaba/hakaret', liste.length, kelime); continue; }
    birlesen += liste.length - 1;
    liste.sort((a, b) => a.kac - b.kac);
    const k = { ...(liste.find((x) => 'asf'.includes(x.tur)) || liste[0]) };    // isim/sıfat/fiil olan eş sesli öne
    if (tanimlar.has(kelime)) { k.anlam = tanimlar.get(kelime); k.gonderme = false; }   // tanim-duzelt.txt: elle yazılmış tanım
    const sira = siraBul(kelime, k.tur, siklik);
    if (k.gonderme && sira == null) { gondermeSiklikYok++; say('yalnız ► göndermesi var, sıklıkta yok', 1, kelime); continue; }
    const bant = bantBul({ kelime, sira, tur: k.tur, eski: k.eski, cocuk: cocuk.has(kelime) });
    kayitlar.push({ kelime, anlam: k.anlam, tur: k.tur, bant, puan: puanla(kelime, sira), sira, eski: k.eski, gonderme: k.gonderme, gizli: k.gizli });
  }
  kayitlar.sort((a, b) => (a.kelime < b.kelime ? -1 : a.kelime > b.kelime ? 1 : 0));
  return { kayitlar, elenen, ornekler, kabulMadde, benzersiz: adaylar.size, birlesen, gondermeSiklikYok, zehirli };
}
