/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Personal Koski "opinnot" endpoint URL (contains a secret token).
   * Server-only: no `PUBLIC_` prefix, so it is never exposed to the client bundle.
   */
  readonly KOSKI_OPINNOT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
