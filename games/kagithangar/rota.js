// Hash rotası eşleştirici. DOM'suz: node testinde de çalışır.
// Desen: '/atolye/:tasarim' → { ad, params: { tasarim } }.

export function derle(desen) {
  const adlar = [];
  const kaynak = desen.replace(/:([a-zA-Z]+)/g, (_, ad) => { adlar.push(ad); return '([^/]+)'; });
  return { desen, adlar, re: new RegExp('^' + kaynak + '/?$') };
}

// hash: '#/atolye/ok' gibi. Boş hash varsayılan rotaya gider.
export function esle(rotalar, hash, varsayilan = '/masa') {
  const yol = (hash || '').replace(/^#/, '') || varsayilan;
  for (const r of rotalar) {
    const m = r.re.exec(yol);
    if (!m) continue;
    const params = {};
    r.adlar.forEach((ad, i) => {
      try { params[ad] = decodeURIComponent(m[i + 1]); } catch (e) { params[ad] = m[i + 1]; }
    });
    return { rota: r, params };
  }
  return null;
}
