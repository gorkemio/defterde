// Dokunmatik sayı tuşları; doğrulama ve sıra değiştirme kontrolörde kalır.
(function () {
  'use strict';
  window.AB.keypad = function ({ submit, enabled, announce }) {
    const panel = document.getElementById('sayi-paneli'), input = document.getElementById('giris');
    function edit(key) {
      if (!enabled()) return;
      if (key === 'Backspace' || key === 'Delete') input.value = input.value.slice(0, -1);
      else if (/^[0-9]$/.test(key)) input.value = (input.value + key).slice(0, 3);
      else return;
      announce(input.value || 'Cevap silindi');
    }
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !enabled()) return;
      if (b.id === 'sayi-tamam') submit();
      else edit(b.dataset.sayi ?? 'Backspace');
    });
    document.addEventListener('keydown', e => {
      if (!input.readOnly || !enabled() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); edit(e.key);
      } else if (e.key === 'Enter' && !e.target.closest('button') && e.target !== input) {
        e.preventDefault(); submit();
      }
    });
    return function update(touch, shown, active) {
      input.readOnly = touch;
      input.inputMode = touch ? 'none' : 'numeric';
      panel.hidden = !touch || !shown;
      panel.querySelectorAll('button').forEach(b => { b.disabled = !active; });
      document.documentElement.dataset.keypad = String(touch && shown);
    };
  };
})();
