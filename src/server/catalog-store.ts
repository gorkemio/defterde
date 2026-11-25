import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  catalogItems,
  persistedCatalogItems,
  seed,
  type Snapshot,
} from '../lib/catalog.js';
const snapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  items: catalogItems,
  publishedAt: z.string().nullable(),
});
export class CatalogStore {
  current: Snapshot = structuredClone(seed);
  private queue: Promise<unknown> = Promise.resolve();
  constructor(public path: string) {}
  async load() {
    try {
      const source = await readFile(this.path, 'utf8');
      const saved = JSON.parse(source);
      this.current = snapshotSchema
        .extend({ items: persistedCatalogItems })
        .parse(saved);
      if (saved.items.length < this.current.items.length) {
        try {
          await writeFile(`${this.path}.before-besharf`, source, {
            flag: 'wx',
            mode: 0o600,
            flush: true,
          });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  /** Yayın sonrası snapshot: eş zamanlı yazımlarda eski revizyon yeniyi ezmez. */
  async accept(snapshot: Snapshot) {
    return this.enqueue(async () => {
      if (snapshot.revision < this.current.revision) return;
      await this.write(snapshot);
    });
  }
  /**
   * Veritabanından okunan yayını kuyruk içinde uygular. Okuma kuyrukta yapıldığı
   * için önceki bütün yayınlar zaten işlenmiştir; daha düşük bir revizyon ancak
   * veritabanı geri yüklendiğinde görülür ve bu durumda veritabanı esas alınır.
   */
  async sync(read: () => Promise<Snapshot>) {
    return this.enqueue(async () => {
      const snapshot = await read();
      if (snapshot.revision < this.current.revision)
        console.warn(
          `Database catalog revision ${snapshot.revision} is behind snapshot ${this.current.revision}; using the database`,
        );
      await this.write(snapshot);
    });
  }
  private enqueue(work: () => Promise<void>) {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  private async write(snapshot: Snapshot) {
    snapshotSchema.parse(snapshot);
    if (JSON.stringify(snapshot) === JSON.stringify(this.current)) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(snapshot), {
      mode: 0o600,
      flush: true,
    });
    await rename(temp, this.path);
    this.current = snapshot;
  }
}
