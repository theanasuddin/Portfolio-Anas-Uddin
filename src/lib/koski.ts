/**
 * Koski (Finnish national study registry, opintopolku.fi) integration.
 *
 * Fetches the live study record from the personal Koski "opinnot" endpoint and
 * computes the total number of completed ECTS credits for the degree.
 *
 * SECURITY: The endpoint URL embeds a personal secret token, so it is read from
 * the `KOSKI_OPINNOT_URL` environment variable (no `PUBLIC_` prefix => Astro keeps
 * it server-only and never ships it to the browser bundle). This module must only
 * ever be imported from server contexts (the `/api` route and `.astro` frontmatter),
 * never from a client `<script>`.
 */

/**
 * Koski codelist `opintojenlaajuusyksikko` -> "2" means opintopiste (ECTS credit).
 * We only count units measured in ECTS to avoid mixing in other scales.
 */
const ECTS_UNIT_CODE = "2";

interface KoskiLaajuus {
  arvo?: number;
  yksikkö?: { koodiarvo?: string };
}

interface KoskiArviointi {
  hyväksytty?: boolean;
}

interface KoskiOsasuoritus {
  koulutusmoduuli?: { laajuus?: KoskiLaajuus };
  arviointi?: KoskiArviointi[];
  vahvistus?: unknown;
  // Nested sub-components (exams, "participation in teaching", etc.). These repeat
  // the same credits as their parent course unit and must NOT be summed.
  osasuoritukset?: KoskiOsasuoritus[];
}

interface KoskiSuoritus {
  osasuoritukset?: KoskiOsasuoritus[];
}

interface KoskiOpiskeluoikeus {
  suoritukset?: KoskiSuoritus[];
}

export interface KoskiResponse {
  opiskeluoikeudet?: KoskiOpiskeluoikeus[];
}

/**
 * A course unit counts toward the degree only when it has been completed with a
 * confirmed passing grade ("vahvistettu", hyväksytty). In-progress / enrolled units
 * have no passing assessment yet and are excluded.
 */
function isCompletedAndPassed(unit: KoskiOsasuoritus): boolean {
  const assessments = unit.arviointi;
  if (!Array.isArray(assessments) || assessments.length === 0) return false;
  // The last assessment is the authoritative one in Koski.
  return assessments[assessments.length - 1]?.hyväksytty === true;
}

/**
 * Sum the ECTS credits of completed, passed top-level course units.
 *
 * We intentionally iterate ONLY the top-level `osasuoritukset` of each degree
 * `suoritus` (the course units) and never recurse into their nested
 * `osasuoritukset` (exams, sub-components), since those repeat the same credits
 * and would double-count.
 */
export function sumCompletedEcts(data: KoskiResponse | null | undefined): number {
  let total = 0;

  for (const opiskeluoikeus of data?.opiskeluoikeudet ?? []) {
    for (const suoritus of opiskeluoikeus.suoritukset ?? []) {
      for (const courseUnit of suoritus.osasuoritukset ?? []) {
        if (!isCompletedAndPassed(courseUnit)) continue;

        const laajuus = courseUnit.koulutusmoduuli?.laajuus;
        if (!laajuus || typeof laajuus.arvo !== "number") continue;

        // Skip anything not measured in ECTS credits.
        if (laajuus.yksikkö?.koodiarvo && laajuus.yksikkö.koodiarvo !== ECTS_UNIT_CODE) {
          continue;
        }

        total += laajuus.arvo;
      }
    }
  }

  // ECTS credits are whole numbers; round to guard against float artifacts.
  return Math.round(total);
}

/**
 * Fetch the Koski study record and return the total completed ECTS credits.
 *
 * @throws if `KOSKI_OPINNOT_URL` is missing or the endpoint responds with an error.
 */
export async function fetchCompletedEcts(): Promise<number> {
  // Astro exposes non-PUBLIC_ vars via import.meta.env on the server only: it
  // reads from the build environment for prerendered pages and from the runtime
  // environment for SSR routes (the Vercel serverless function).
  const url = import.meta.env.KOSKI_OPINNOT_URL;
  if (!url) {
    throw new Error("KOSKI_OPINNOT_URL is not configured");
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    // Don't let a slow government endpoint hang the build/request indefinitely.
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Koski API responded with ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as KoskiResponse;
  return sumCompletedEcts(data);
}
