// Örnekler aynı oturum/motor akışını kullanır; asıl oyun yalnız bellekte tutulur.
(function (root) {
  'use strict';
  function wait(ms, signal) {
    return new Promise(resolve => {
      const finish = () => { root.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = root.setTimeout(finish, ms);
      signal.addEventListener('abort', finish, { once: true });
      if (signal.aborted) finish();
    });
  }
  function create(session, { onChange = () => {}, pause = wait } = {}) {
    let saved = null, state = null, generation = 0, controller = new root.AbortController();
    function cancel() { generation++; controller.abort(); controller = new root.AbortController(); }
    function publish(value) { state = value && Object.freeze(value); onChange(state); }
    async function watch(id) {
      const lesson = root.TD.lessons.find(l => l.id === id);
      if (!lesson) throw new TypeError('Bilinmeyen örnek.');
      cancel();
      const task = generation, signal = controller.signal;
      if (!saved) saved = session.stash();
      publish({ lesson, index: 0, running: true, error: null });
      try {
        await session.configure({ mode: 'local' });
        if (task !== generation) return;
        await session.start(lesson.position);
        if (task !== generation) return;
        await session.choose(lesson.route[0]);
        for (let i = 1; i < lesson.route.length; i++) {
          await pause(1100, signal);
          if (task !== generation) return;
          await session.choose(lesson.route[i]);
          if (task !== generation) return;
          if (session.read().error) throw new Error(session.read().error);
          publish({ lesson, index: i, running: i < lesson.route.length - 1, error: null });
        }
      } catch (e) {
        if (task === generation) publish({ ...state, running: false, error: 'Örnek açılamadı. Oyununa dönebilirsin.' });
      }
    }
    async function stop() {
      cancel();
      const original = saved;
      saved = null; publish(null);
      if (original) await session.restore(original);
    }
    function discard() {
      cancel(); saved = null; publish(null); session.suspend();
    }
    return Object.freeze({ watch, stop, discard, read: () => state });
  }
  root.TD.tutorial = Object.freeze({ create });
})(globalThis);
