(function (root) {
  'use strict';
  const TD = root.TD, key = 'defterde-turkdamasi-ayarlar-v1';
  const defaults = TD.config.defaults;
  function validate(value = {}) {
    const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.freeze({
      mode: ['ai', 'local'].includes(v.mode) ? v.mode : defaults.mode,
      human: [1, -1].includes(v.human) ? v.human : defaults.human,
      level: ['easy', 'medium', 'hard'].includes(v.level) ? v.level : defaults.level,
      help: typeof v.help === 'boolean' ? v.help : defaults.help,
      sound: typeof v.sound === 'boolean' ? v.sound : defaults.sound,
      motion: ['system', 'reduce', 'full'].includes(v.motion) ? v.motion : defaults.motion,
    });
  }
  function create(storage = () => root.localStorage) {
    let memory = validate();
    try {
      const value = JSON.parse(storage().getItem(key));
      if (value?.version === 1) memory = validate(value);
    } catch (_) { /* Depolama kapalıysa aynı oturumda bellek yeterlidir. */ }
    return Object.freeze({
      read: () => memory,
      save(values) {
        memory = validate({ ...memory, ...values });
        try { storage().setItem(key, JSON.stringify({ version: 1, ...memory })); } catch (_) { /* Bellek yedeği. */ }
        return memory;
      },
    });
  }
  TD.settings = Object.freeze({ create, validate, key });
})(globalThis);
