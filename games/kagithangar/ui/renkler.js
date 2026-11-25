// Mürekkep renkleri tek kaynaktan: style.css / kit/kagit.css :root değişkenleri. Tuval (canvas) ve rough.js CSS
// değişkeni okuyamadığı için değerler bir kez okunur; okunamazsa (test, eski tarayıcı) aynı değerler yedektir.
const YEDEK = { mavi: '#1f3b9b', kirmizi: '#c62828', kursun: '#6b6b6b', yesil: '#2e7d32', kagit: '#fbf9f2' };

function oku() {
  const r = { ...YEDEK };
  try {
    const cs = getComputedStyle(document.documentElement);
    for (const ad of Object.keys(YEDEK)) {
      const v = cs.getPropertyValue('--' + ad).trim();
      if (v) r[ad] = v;
    }
  } catch (e) { /* DOM yok: yedek */ }
  return r;
}

export const RENK = Object.freeze(oku());
