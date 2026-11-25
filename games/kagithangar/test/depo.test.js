import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depoOlustur, yeniUcak, ANAHTAR, SURUM } from '../depo.js';
import { isimOner, HAZIR } from '../isimler.js';

const sahte = (ilk) => {
  const m = new Map(ilk ? [[ANAHTAR, ilk]] : []);
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
};

test('uçak eklenir, güncellenir, yeniden açılınca yerinde (sayfa yenileme)', () => {
  const s = sahte();
  const d = depoOlustur(s);
  const u = yeniUcak({ tasarim: 'ok', kalite: 91, mod: 'elle', hassasiyetler: [90, 92] });
  d.ucakEkle(u);
  d.ucakGuncelle(u.id, { ad: 'Mavi Şimşek', ayar: { kanatcik: 1 }, boya: { cizgiler: [{ renk: 'mavi', kanat: 'sag', noktalar: [[0.3, 1.2, 19, 0.2, 1.2]] }] } });
  const d2 = depoOlustur(s);
  const v = d2.ucak(u.id);
  assert.equal(v.ad, 'Mavi Şimşek');
  assert.equal(v.kalite, 91);
  assert.deepEqual(v.ayar, { kanatcik: 1, kivrimSol: 0, kivrimSag: 0, atac: 0 });
  assert.equal(v.boya.cizgiler[0].kanat, 'sag');
  assert.equal(JSON.parse(s.m.get(ANAHTAR)).surum, 1);
});

test('bozuk ya da bilinmeyen sürüm kayıt silinmez, üstüne yazılmaz', () => {
  const s = sahte('{"surum": 9, "ucaklar": []}');
  const d = depoOlustur(s);
  assert.equal(d.yazilabilir, false);
  d.ucakEkle(yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' }));
  assert.equal(s.m.get(ANAHTAR), '{"surum": 9, "ucaklar": []}');
  const b = sahte('{bozuk');
  depoOlustur(b).ucakEkle(yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' }));
  assert.equal(b.m.get(ANAHTAR), '{bozuk');
});

test('yedekle ve geri yükle; birleştirme çift kaydı atlar', () => {
  const a = depoOlustur(sahte());
  const u = yeniUcak({ tasarim: 'marti', kalite: 70, mod: 'elle' });
  a.ucakEkle(u);
  const yedek = a.yedekle();
  const b = depoOlustur(sahte());
  b.ucakEkle(yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' }));
  assert.equal(b.geriYukle(yedek, { birlestir: true }), 2);
  assert.equal(b.geriYukle(yedek, { birlestir: true }), 2);
  assert.equal(b.geriYukle(yedek), 1);
  assert.throws(() => b.geriYukle('{"foo":1}'));
});

test('uçuş günlüğü son 50 kayıtla sınırlı, uzun ad kırpılır', () => {
  const d = depoOlustur(sahte());
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  d.ucakEkle(u);
  for (let i = 0; i < 60; i++) d.ucusEkle(u.id, { mesafe: i, yol: [] });
  assert.equal(d.ucak(u.id).gunluk.length, 50);
  assert.equal(d.ucak(u.id).gunluk[49].mesafe, 59);
  assert.equal(d.ucakGuncelle(u.id, { ad: 'x'.repeat(40) }).ad.length, 24);
});

test('isim önerici dolu ve Türkçe isimler üretir', () => {
  let t = 1;
  const r = () => { t = (t * 16807) % 2147483647; return t / 2147483647; };
  for (let i = 0; i < 50; i++) {
    const ad = isimOner(r);
    assert.ok(typeof ad === 'string' && ad.length >= 2 && ad.length <= 24, ad);
  }
  assert.ok(HAZIR.includes('Mavi Şimşek') && HAZIR.includes('Pencere Kırıcı'));
});

test('dijital ikiz, gelen not ve pilot adı saklanır; geçersiz mesafe reddedilir', () => {
  const s = sahte();
  const d = depoOlustur(s);
  const u = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  d.ucakEkle({ ...u, not: { metin: 'merhaba', gonderen: 'Ece', tarih: '2026-10-18' }, kaynak: 'abc' });
  assert.equal(d.gercekEkle(u.id, 6.43).gercek[0].mesafe, 6.4);
  assert.equal(d.gercekEkle(u.id, -3), null);
  assert.equal(d.gercekEkle(u.id, NaN), null);
  d.ayarGuncelle({ pilotAdi: 'Ece' });
  const d2 = depoOlustur(s);
  assert.equal(d2.ucak(u.id).gercek.length, 1);
  assert.equal(d2.ucak(u.id).not.gonderen, 'Ece');
  assert.equal(d2.ucak(u.id).kaynak, 'abc');
  assert.equal(d2.ayarlar().pilotAdi, 'Ece');
});

test('sıfırla: uçaklar, günlükler ve ayarlar silinir; okunamayan kaydın üstüne de yazar', () => {
  const m = new Map();
  const saklama = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  const D = depoOlustur(saklama);
  const u = yeniUcak({ tasarim: 'ok', kalite: 80, mod: 'izle' });
  D.ucakEkle(u);
  D.ucusEkle(u.id, { mesafe: 5, yol: [] });
  D.ayarGuncelle({ pilotAdi: 'Ece', sessiz: true });
  assert.equal(D.sifirla(), true);
  assert.equal(D.ucaklar().length, 0);
  assert.equal(D.ayarlar().pilotAdi, undefined);
  assert.equal(JSON.parse(m.get(ANAHTAR)).ucaklar.length, 0);
  // bilinmeyen sürüm: normalde dokunulmaz, sıfırlama açıkça istenince boş hangar yazılır
  m.set(ANAHTAR, JSON.stringify({ surum: 99, ucaklar: [{ id: 'x' }] }));
  const D2 = depoOlustur(saklama);
  assert.equal(D2.yazilabilir, false);
  D2.sifirla();
  assert.equal(D2.yazilabilir, true);
  assert.equal(JSON.parse(m.get(ANAHTAR)).surum, SURUM);
});

test('ayarlar: taze depoda ve eski kayıtta varsayılanlar; geçersiz değerler düzelir', () => {
  const t = depoOlustur(sahte()).ayarlar();
  assert.equal(t.sonSahne, 'sinif');
  assert.equal(t.sonMod, 'izle');
  assert.equal(t.gununBasari, 0);
  assert.deepEqual(t.ipuclari, {});
  const eski = sahte(JSON.stringify({ surum: SURUM, ucaklar: [], ayarlar: { sessiz: false, pilotAdi: 'Ece' } }));
  const e = depoOlustur(eski).ayarlar();
  assert.equal(e.sonSahne, 'sinif');
  assert.equal(e.pilotAdi, 'Ece');
  const d = depoOlustur(sahte());
  assert.equal(d.ayarGuncelle({ sonSahne: 'park', sonMod: 'elle' }).sonSahne, 'park');
  assert.equal(d.ayarGuncelle({ sonSahne: 'ay' }).sonSahne, 'sinif');
  assert.equal(d.ayarGuncelle({ sonMod: 'karma' }).sonMod, 'izle');
  assert.equal(d.ayarGuncelle({ gununBasari: -3 }).gununBasari, 0);
});

test('eşsiz isim: hangardaki isimleri tekrar etmez, havuz dolunca sayı ekler', async () => {
  const { isimOnerEssiz } = await import('../isimler.js');
  let t = 7;
  const tohumlu = () => { t = (t * 16807) % 2147483647; return t / 2147483647; };
  const kullanilan = [];
  for (let i = 0; i < 50; i++) {
    const ad = isimOnerEssiz(kullanilan, tohumlu);
    assert.ok(!kullanilan.map(a => a.toLocaleLowerCase('tr')).includes(ad.toLocaleLowerCase('tr')), ad);
    kullanilan.push(ad);
  }
  assert.equal(isimOnerEssiz(['Gölge'], () => 0), 'Mavi Şimşek');
  assert.equal(isimOnerEssiz(['Mavi Şimşek'], () => 0), 'Mavi Şimşek 2');
  assert.equal(isimOnerEssiz(['mavi şimşek', 'Mavi Şimşek 2'], () => 0), 'Mavi Şimşek 3');
});

test('ipuçları: ilk atış öğretildi bilgisi saklanır, bozuk değer boş nesneye döner', () => {
  const s = sahte();
  const d = depoOlustur(s);
  d.ayarGuncelle({ ipuclari: { atis: true } });
  assert.deepEqual(depoOlustur(s).ayarlar().ipuclari, { atis: true });
  assert.deepEqual(d.ayarGuncelle({ ipuclari: 'bozuk' }).ipuclari, {});
});

test('uçak silinir ve kayıt kalıcıdır; öbür uçaklar yerinde', () => {
  const s = sahte();
  const d = depoOlustur(s);
  const a = yeniUcak({ tasarim: 'ok', kalite: 85, mod: 'izle' });
  const b = yeniUcak({ tasarim: 'kilit', kalite: 90, mod: 'elle' });
  d.ucakEkle(a); d.ucakEkle(b);
  d.ucakSil(a.id);
  const d2 = depoOlustur(s);
  assert.equal(d2.ucak(a.id), null);
  assert.deepEqual(d2.ucaklar().map(u => u.id), [b.id]);
});
