// İsteğe bağlı: kendi elle çizdiğin PNG'leri (şeffaf arka planlı) assets/ klasörüne koyup adlarını buraya yaz.
// Listede olmayan ya da açılamayan dosya için oyun kendi çizdiği SVG'ye döner; her parça ayrı ayrı denenir.
// Ayrıntılar: assets/README.md
(window.KF = window.KF || {}).varliklar = [
  // 'top.png', 'kaleci-normal.png', 'kaleci-uzgun.png', 'kaleci-sevincli.png',
  // 'kaptan-normal.png', 'kaptan-dusunuyor.png', 'kaptan-sirit.png', 'kaptan-somurt.png',
  // 'sus-kupa.png', 'sus-bayrak.png', 'sus-top.png',
];

// İsteğe bağlı gerçek ses kayıtları (assets/ içinde; mp3, ogg ya da wav). Adı oyundaki sesin adıdır: 'gol.mp3' gol anında,
// 'sikisma.mp3' sıkışmada, 'kazan.mp3' / 'kaybet.mp3' oyun sonunda çalar. Listede olmayan ya da açılamayan için sentez çalar.
window.KF.sesDosyalari = [
  'gol.mp3',   // gerçek kalabalık alkışı (Stephan, kamu malı) — ayrıntı: assets/README.md
];
