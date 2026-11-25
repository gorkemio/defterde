#!/usr/bin/env python3
# scripts/font-tr.py — Mynerve'nin "ş" glifini düzeltir; bağımlılık yok (yalnız standart kitaplık).
# Sorun: kaynak fontta küçük ş (U+015F) büyük S'den türemiş: küçük s 480 birim, ş 709 birim yüksekliğinde; Türkçe metinde
# "giriŞ", "BaŞtan" okunur. Tarayıcı s + U+0327 dizisini de aynı bozuk glife birleştirir. Düzeltme: ş glifi, ç'deki gibi,
# küçük s ile fontun kendi birleşen çengelinden (U+0327) kurulan bileşik glif olur; ilerleme genişliği s'ninki.
# Girdi:  assets/fonts/Mynerve-Regular.ttf (google/fonts, değiştirilmeden)   Çıktı: assets/fonts/Mynerve-Regular-tr.ttf
# OFL 1.1: Mynerve için ayrılmış font adı (Reserved Font Name) yok; değiştirilmiş sürüm aynı lisansla dağıtılır.
import struct, os

KOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GIRDI = os.path.join(KOK, 'assets/fonts/Mynerve-Regular.ttf')
CIKTI = os.path.join(KOK, 'assets/fonts/Mynerve-Regular-tr.ttf')
DX, DY = 103, -26          # çengelin s'nin altındaki yeri (font birimi): s'nin ortası, alt kıvrımına değecek kadar aşağı

d = open(GIRDI, 'rb').read()
sayi = struct.unpack('>H', d[4:6])[0]
tablolar = {}
for i in range(sayi):
    t, _, o, l = struct.unpack('>4sIII', d[12 + 16 * i:28 + 16 * i])
    tablolar[t.decode('latin-1')] = bytearray(d[o:o + l])

def cmap_oku(c):
    sonuc, nt = {}, struct.unpack('>H', c[2:4])[0]
    for i in range(nt):
        _, _, off = struct.unpack('>HHI', c[4 + 8 * i:12 + 8 * i])
        s = off
        if struct.unpack('>H', c[s:s + 2])[0] != 4: continue
        seg = struct.unpack('>H', c[s + 6:s + 8])[0] // 2
        son = struct.unpack('>%dH' % seg, c[s + 14:s + 14 + 2 * seg])
        bas = struct.unpack('>%dH' % seg, c[s + 16 + 2 * seg:s + 16 + 4 * seg])
        fark = struct.unpack('>%dh' % seg, c[s + 16 + 4 * seg:s + 16 + 6 * seg])
        rp = s + 16 + 6 * seg
        ro = struct.unpack('>%dH' % seg, c[rp:rp + 2 * seg])
        for k, (a, b) in enumerate(zip(bas, son)):
            for ch in range(a, b + 1):
                if ro[k] == 0: g = (ch + fark[k]) & 0xffff
                else:
                    gp = rp + 2 * k + ro[k] + 2 * (ch - a)
                    g = struct.unpack('>H', c[gp:gp + 2])[0]
                    if g: g = (g + fark[k]) & 0xffff
                sonuc[ch] = g
    return sonuc

cmap = cmap_oku(tablolar['cmap'])
head, maxp, hhea, hmtx = tablolar['head'], tablolar['maxp'], tablolar['hhea'], tablolar['hmtx']
kisa = struct.unpack('>h', head[50:52])[0] == 0
glif_sayisi = struct.unpack('>H', maxp[4:6])[0]
loca, glyf = tablolar['loca'], tablolar['glyf']
yer = [2 * v for v in struct.unpack('>%dH' % (glif_sayisi + 1), loca)] if kisa else list(struct.unpack('>%dI' % (glif_sayisi + 1), loca))
glifler = [bytes(glyf[yer[i]:yer[i + 1]]) for i in range(glif_sayisi)]

S, SC, CENGEL = cmap[0x73], cmap[0x15F], cmap[0x327]
kutu = lambda g: struct.unpack('>hhhhh', glifler[g][:10])
_, sx0, sy0, sx1, sy1 = kutu(S)
_, cx0, cy0, cx1, cy1 = kutu(CENGEL)
assert kutu(S)[0] > 0 and kutu(CENGEL)[0] > 0, 'basit glif bekleniyordu'

# Bileşik glif: başlık (kontur −1 + kutu), s (ölçüleri s'den: USE_MY_METRICS), çengel (DX, DY kaydırılmış)
ARG_WORDS, XY, ROUND, MORE, METRICS = 0x1, 0x2, 0x4, 0x20, 0x200
x0, y0 = min(sx0, cx0 + DX), min(sy0, cy0 + DY)
x1, y1 = max(sx1, cx1 + DX), max(sy1, cy1 + DY)
yeni = struct.pack('>hhhhh', -1, x0, y0, x1, y1)
yeni += struct.pack('>HHhh', ARG_WORDS | XY | ROUND | MORE | METRICS, S, 0, 0)
yeni += struct.pack('>HHhh', ARG_WORDS | XY | ROUND, CENGEL, DX, DY)
glifler[SC] = yeni

# glyf + loca yeniden: her glif 4 bayta hizalı (kısa loca 2'nin katı ister)
yglyf, yyer = bytearray(), []
for g in glifler:
    yyer.append(len(yglyf))
    yglyf += g
    while len(yglyf) % 4: yglyf += b'\0'
yyer.append(len(yglyf))
if kisa and yyer[-1] // 2 > 0xFFFF: kisa = False; head[50:52] = struct.pack('>h', 1)
tablolar['glyf'] = yglyf
tablolar['loca'] = bytearray(struct.pack('>%dH' % len(yyer), *[v // 2 for v in yyer]) if kisa else struct.pack('>%dI' % len(yyer), *yyer))

# hmtx: ş'nin ilerlemesi ve sol boşluğu s'ninki
nhm = struct.unpack('>H', hhea[34:36])[0]
def olcu(g):
    if g < nhm: return struct.unpack('>Hh', hmtx[4 * g:4 * g + 4])
    return struct.unpack('>H', hmtx[4 * (nhm - 1):4 * (nhm - 1) + 2])[0], struct.unpack('>h', hmtx[4 * nhm + 2 * (g - nhm):4 * nhm + 2 * (g - nhm) + 2])[0]
s_ilerleme, s_sol = olcu(S)
assert SC < nhm, 'ş glifinin kendi ilerleme kaydı olmalı'
hmtx[4 * SC:4 * SC + 4] = struct.pack('>Hh', s_ilerleme, x0)

# maxp (sürüm 1.0): bileşik sınırları
if struct.unpack('>I', maxp[0:4])[0] == 0x00010000:
    nokta = lambda g: struct.unpack('>H', glifler[g][10 + 2 * (kutu(g)[0] - 1):12 + 2 * (kutu(g)[0] - 1)])[0] + 1
    alanlar = {'nokta': (10, nokta(S) + nokta(CENGEL)), 'kontur': (12, kutu(S)[0] + kutu(CENGEL)[0]), 'bilesen': (28, 2), 'derinlik': (30, 1)}
    for _, (of, v) in alanlar.items():
        if struct.unpack('>H', maxp[of:of + 2])[0] < v: maxp[of:of + 2] = struct.pack('>H', v)

# Dosyayı yaz: tablo dizini, sağlama toplamları, head.checkSumAdjustment
def toplam(b):
    b = bytes(b) + b'\0' * ((4 - len(b) % 4) % 4)
    return sum(struct.unpack('>%dI' % (len(b) // 4), b)) & 0xFFFFFFFF
head[8:12] = b'\0\0\0\0'
adlar = sorted(tablolar)
es = 1
while es * 2 <= len(adlar): es *= 2
bas = struct.pack('>IHHHH', 0x00010000, len(adlar), es * 16, es.bit_length() - 1, len(adlar) * 16 - es * 16)
konum, dizin, govde = 12 + 16 * len(adlar), b'', b''
for ad in adlar:
    v = bytes(tablolar[ad])
    dizin += struct.pack('>4sIII', ad.encode('latin-1'), toplam(v), konum + len(govde), len(v))
    govde += v + b'\0' * ((4 - len(v) % 4) % 4)
font = bytearray(bas + dizin + govde)
ayar = (0xB1B0AFBA - toplam(font)) & 0xFFFFFFFF
hk = konum + sum(len(bytes(tablolar[a])) + (4 - len(tablolar[a]) % 4) % 4 for a in adlar[:adlar.index('head')])
font[hk + 8:hk + 12] = struct.pack('>I', ayar)
open(CIKTI, 'wb').write(font)
print('yazıldı:', os.path.relpath(CIKTI, KOK), len(font), 'bayt; ş = s(%d) + çengel(%d) @ (%d, %d), kutu %s' % (S, CENGEL, DX, DY, (x0, y0, x1, y1)))
