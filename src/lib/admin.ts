const root = document.querySelector<HTMLElement>('#admin-app');
if (root) {
  const status = document.querySelector<HTMLOutputElement>('#status')!;
  const form = document.querySelector<HTMLFormElement>('#catalog-form')!;
  const publish = document.querySelector<HTMLButtonElement>('#publish')!;
  const save = document.querySelector<HTMLButtonElement>('#save')!;
  const restore = document.querySelector<HTMLButtonElement>('#restore')!;
  const fields = [...form.querySelectorAll<HTMLFieldSetElement>('fieldset')];
  const csrf = root.dataset.csrf!;
  let version = 0,
    loaded = false,
    dirty = false,
    busy = false;
  const message = (s: string) => {
    status.textContent = s;
  };
  function controls() {
    save.disabled = !loaded || busy;
    publish.disabled = !loaded || busy || dirty;
    restore.disabled = !loaded || busy || dirty;
  }
  async function api(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : {};
    if (res.status === 401 && path !== '/auth/logout') {
      window.location.assign('/yonetim/');
      throw new Error('Oturumun sona erdi. Yeniden giriş yap.');
    }
    if (!res.ok)
      throw new Error(
        data.error ||
          `Sunucu yanıt vermedi (HTTP ${res.status}). Biraz sonra tekrar dene.`,
      );
    return data;
  }
  async function action(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    controls();
    try {
      await task();
    } catch (e) {
      message(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      busy = false;
      controls();
    }
  }
  function input(slug: string, suffix: string) {
    return form.elements.namedItem(`${slug}-${suffix}`) as HTMLInputElement;
  }
  async function load() {
    const data = await api('/api/v1/admin/catalog');
    version = data.version;
    data.draft.forEach(
      (
        item: {
          slug: string;
          title: string;
          description: string;
          visible: boolean;
        },
        i: number,
      ) => {
        input(item.slug, 'title').value = item.title;
        input(item.slug, 'description').value = item.description;
        input(item.slug, 'order').value = String(i + 1);
        input(item.slug, 'visible').checked = item.visible;
      },
    );
    const history = document.querySelector<HTMLSelectElement>('#history')!;
    history.replaceChildren(
      ...data.history.map((r: { id: number; createdAt: string }) => {
        const o = document.createElement('option');
        o.value = String(r.id);
        o.textContent = `Revizyon ${r.id} · ${new Date(r.createdAt).toLocaleString('tr-TR')}`;
        return o;
      }),
    );
    document.querySelector('#revision')!.textContent =
      `Taslak ${data.version} · Yayın ${data.publishedRevision}`;
    loaded = true;
    dirty = false;
    controls();
  }
  async function statistics() {
    const [metrics, audit] = await Promise.all([
      api('/api/v1/admin/metrics'),
      api('/api/v1/admin/audit'),
    ]);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const cutoff = new Date(
      new Date(today + 'T12:00:00Z').getTime() - 6 * 86400_000,
    )
      .toISOString()
      .slice(0, 10);
    const tbody = document.querySelector('#metrics')!;
    tbody.replaceChildren(
      ...fields.map((field) => {
        const slug = field.dataset.slug!,
          row = document.createElement('tr');
        const vals = [
          field.querySelector('legend')!.textContent!,
          ...[7, 30].map((days) =>
            String(
              metrics.days
                .filter(
                  (d: { slug: string; day: string }) =>
                    d.slug === slug && (days === 30 || d.day >= cutoff),
                )
                .reduce(
                  (n: number, d: { count: number }) => n + Number(d.count),
                  0,
                ),
            ),
          ),
        ];
        vals.forEach((value, i) => {
          const cell = document.createElement(i === 0 ? 'th' : 'td');
          if (i === 0) cell.setAttribute('scope', 'row');
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }),
    );
    const labels: Record<string, string> = {
      register_game: 'Kataloğa oyun eklendi',
      register_games: 'Kataloğa oyunlar eklendi',
      rollback_game: 'Oyun kaydı geri alındı',
      save: 'Taslak kaydedildi',
      publish: 'Katalog yayımlandı',
      restore: 'Önceki revizyon yayımlandı',
      login: 'Giriş yapıldı',
      logout: 'Çıkış yapıldı',
    };
    document.querySelector('#audit')!.replaceChildren(
      ...audit.entries.map(
        (entry: {
          action: string;
          createdAt: string;
          revision: number | null;
        }) => {
          const li = document.createElement('li');
          li.textContent = `${new Date(entry.createdAt).toLocaleString('tr-TR')} · ${labels[entry.action] || entry.action}${entry.revision === null ? '' : ` · Revizyon ${entry.revision}`}`;
          return li;
        },
      ),
    );
  }
  form.addEventListener('input', () => {
    dirty = true;
    controls();
    message('Kaydedilmemiş değişiklikler var. Önce taslağı kaydet.');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void action(async () => {
      if (!form.reportValidity()) return;
      const ordered = fields.map((f) => ({
        slug: f.dataset.slug!,
        order: Number(input(f.dataset.slug!, 'order').value),
      }));
      if (new Set(ordered.map((o) => o.order)).size !== fields.length)
        throw new Error('Her oyuna farklı bir sıra numarası ver.');
      const items = ordered
        .sort((a, b) => a.order - b.order)
        .map(({ slug }) => ({
          slug,
          title: input(slug, 'title').value,
          description: input(slug, 'description').value,
          visible: input(slug, 'visible').checked,
        }));
      const result = await api('/api/v1/admin/catalog', 'PATCH', {
        version,
        items,
      });
      version = result.version;
      dirty = false;
      await load();
      message('Taslak kaydedildi. Önizleyebilir veya yayımlayabilirsin.');
    });
  });
  publish.addEventListener(
    'click',
    () =>
      void action(async () => {
        await api('/api/v1/admin/catalog/publish', 'POST', { version });
        await load();
        await statistics();
        message('Katalog yayımlandı. Ziyaretçiler bu sürümü görüyor.');
      }),
  );
  document.querySelector('#restore-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void action(async () => {
      await api('/api/v1/admin/catalog/restore', 'POST', {
        version,
        revision: Number(
          (document.querySelector('#history') as HTMLSelectElement).value,
        ),
      });
      await load();
      await statistics();
      message('Seçilen revizyon yeniden yayımlandı.');
    });
  });
  document.querySelector('#reload')!.addEventListener('click', () => {
    if (
      dirty &&
      !window.confirm(
        'Kaydedilmemiş değişikliklerin yerine sunucudaki taslak yüklensin mi?',
      )
    )
      return;
    void action(async () => {
      await load();
      await statistics();
      message('Güncel taslak yüklendi.');
    });
  });
  document.querySelector('#logout')!.addEventListener(
    'click',
    () =>
      void action(async () => {
        // Oturum zaten bitmişse (401) de giriş sayfasına dönülür.
        await api('/auth/logout', 'POST', {}).catch(() => undefined);
        window.location.assign('/yonetim/');
      }),
  );
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
    }
  });
  void action(async () => {
    await load();
    await statistics();
    message('Taslak hazır.');
  });
}
export {};
