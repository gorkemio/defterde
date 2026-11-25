const fs=require('node:fs');
// A source-level fault fixture, not a mutation of a user's browser storage.
const html=fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="../">')
  .replace('<script defer src="assets/vendor/rough-4.6.6.js"></script>',
    `<script>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Test: storage denied','SecurityError');}});</script>
  <script defer src="assets/vendor/rough-4.6.6.js"></script>`);
fs.writeFileSync('tests/storage-denied.html',html);
const blocked=fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="../">')
  .replace('<script defer src="assets/vendor/rough-4.6.6.js"></script>',`<script>
  // Test-only reproducible deal and isolated settings; production sources are unchanged.
  const testSettings = JSON.stringify({mode:'local',target:0,names:['Deniz','Ece']});
  const testMemory = new Map([['domino-defterde-settings',testSettings]]);
  Object.defineProperty(window,'localStorage',{value:{getItem:key=>testMemory.get(key)||null,setItem:(key,value)=>testMemory.set(key,value)}});
  Object.defineProperty(crypto,'getRandomValues',{value:array=>{array.fill(3);return array;}});
  </script><script defer src="assets/vendor/rough-4.6.6.js"></script>`);
fs.writeFileSync('tests/blocked-hand.html',blocked);
console.log('Prepared storage-denied and seed-3 blocked-hand browser fixtures from current index.html');
