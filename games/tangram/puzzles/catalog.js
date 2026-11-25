/* Node giriş noktası. Tarayıcıda kategori dosyaları önce sırayla yüklenir. */
(function(root){
  if(typeof module==='object' && module.exports) module.exports=[
    ...require('./kara-hayvanlari.js'),
    ...require('./kuslar.js'),
    ...require('./deniz-canlilari.js'),
    ...require('./insanlar.js'),
    ...require('./tasitlar.js'),
    ...require('./yapilar.js'),
    ...require('./ev-esyalari.js'),
    ...require('./nesneler.js'),
    ...require('./doga.js'),
    ...require('./geometri.js')
  ];
  else Object.freeze(root.Tangram.puzzles);
})(typeof globalThis==='object'?globalThis:this);
