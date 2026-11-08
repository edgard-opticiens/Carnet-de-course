import { fetchActivityDetail, StravaActivity } from "./strava";
import { ActivityDigest, digestFromDetail } from "./insights";

/**
 * Cache mémoire (par instance de serveur) des résumés kilomètre-par-kilomètre.
 *
 * Pourquoi : lire le détail d'une sortie coûte 1 requête Strava, et la limite est de
 * 100 requêtes / 15 min. Une sortie passée ne change pas, donc on ne la relit pas à chaque
 * chargement. On ne garde que des chiffres agrégés (allure, FC et dénivelé par km, meilleurs
 * efforts) — ni trace GPS, ni nom, ni token. Il est volatil : vidé au redémarrage du serveur.
 */
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ENTRIES = 3000;
const cache = new Map<number, { at: number; digest: ActivityDigest }>();

function prune(now: number) {
  if (cache.size <= MAX_ENTRIES) return;
  for (const [id, v] of cache) {
    if (now - v.at > TTL_MS) cache.delete(id);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export interface LoadDigestsResult {
  digests: Map<number, ActivityDigest>;
  rateLimited: boolean;
  fetched: number;
}

/**
 * Charge les résumés des sorties demandées (les plus récentes d'abord). S'arrête proprement si
 * Strava renvoie 429 ou si le budget de temps est écoulé : l'analyse se fait alors sur ce qu'on a.
 */
export async function loadDigests(
  accessToken: string,
  runs: StravaActivity[],
  budgetMs = 20000,
  concurrency = 4
): Promise<LoadDigestsResult> {
  const now = Date.now();
  const deadline = now + budgetMs;
  const digests = new Map<number, ActivityDigest>();
  const todo: StravaActivity[] = [];

  for (const r of runs) {
    const hit = cache.get(r.id);
    if (hit && now - hit.at < TTL_MS) digests.set(r.id, hit.digest);
    else todo.push(r);
  }

  let rateLimited = false;
  let fetched = 0;
  let cursor = 0;

  async function worker() {
    while (!rateLimited && Date.now() < deadline) {
      const i = cursor++;
      if (i >= todo.length) return;
      const run = todo[i];
      const res = await fetchActivityDetail(accessToken, run.id);
      if (!res.ok) {
        if (res.rateLimited) rateLimited = true;
        continue;
      }
      fetched++;
      const digest = digestFromDetail(res.detail);
      digests.set(run.id, digest);
      cache.set(run.id, { at: Date.now(), digest });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  prune(Date.now());
  return { digests, rateLimited, fetched };
}
