/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    origin: string;
    catalog: import('./lib/catalog').Snapshot;
    admin?: { csrf: string; userId: string };
    authReady: boolean;
    draft?: import('./lib/catalog').CatalogItem[];
  }
}
interface ImportMetaEnv {
  readonly PUBLIC_REPO_URL?: string;
}
