import type { ProviderJobRow } from './normalize.js';

const APIFY_API = 'https://api.apify.com/v2';

export const DEFAULT_NAUKRI_ACTOR = 'jobspipe~naukri-jobs-scraper';
export const DEFAULT_LINKEDIN_JOBS_ACTOR = 'jobspipe~jobspipe-job-search';

export type ApifyRunResult = {
  actorRunId: string;
  datasetId: string;
  status: string;
  items: ProviderJobRow[];
};

export function apifyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.APIFY_TOKEN?.trim());
}

export function actorForSource(sourceKey: string, env: NodeJS.ProcessEnv = process.env): string {
  if (sourceKey === 'naukri_apify') {
    return env.APIFY_NAUKRI_ACTOR_ID?.trim() || DEFAULT_NAUKRI_ACTOR;
  }
  if (sourceKey === 'linkedin_apify') {
    return env.APIFY_LINKEDIN_ACTOR_ID?.trim() || DEFAULT_LINKEDIN_JOBS_ACTOR;
  }
  throw new Error(`No Apify actor mapped for source ${sourceKey}`);
}

export function buildActorInput(
  sourceKey: string,
  cluster: { keywords: string; location?: string; maxJobs?: number },
): Record<string, unknown> {
  const maxJobs = Math.min(Math.max(cluster.maxJobs ?? 50, 1), 200);
  if (sourceKey === 'naukri_apify') {
    return {
      keywords: cluster.keywords,
      location: cluster.location ?? 'India',
      postedWithinDays: 14,
      maxJobs,
    };
  }
  if (sourceKey === 'linkedin_apify') {
    return {
      keywords: cluster.keywords,
      location: cluster.location ?? 'India',
      sources: ['linkedin'],
      maxJobs,
      postedWithinDays: 14,
    };
  }
  throw new Error(`No input builder for source ${sourceKey}`);
}

type ApifyRunResponse = {
  data?: {
    id?: string;
    defaultDatasetId?: string;
    status?: string;
  };
  error?: { message?: string };
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Starts an Apify actor run, waits until finished (bounded), returns dataset items.
 * Desk never calls this synchronously for user requests — ops/cron only.
 */
export async function runApifyActorAndFetch(opts: {
  token: string;
  actorId: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  pollMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ApifyRunResult> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const pollMs = opts.pollMs ?? 3_000;
  const start = Date.now();

  const startRes = await fetchFn(`${APIFY_API}/acts/${opts.actorId}/runs?waitForFinish=0`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts.input),
  });
  const startJson = (await startRes.json()) as ApifyRunResponse;
  if (!startRes.ok || !startJson.data?.id || !startJson.data.defaultDatasetId) {
    throw new Error(startJson.error?.message || `Apify start failed (${startRes.status})`);
  }

  const actorRunId = startJson.data.id;
  const datasetId = startJson.data.defaultDatasetId;
  let status = startJson.data.status ?? 'RUNNING';

  while (status === 'RUNNING' || status === 'READY') {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Apify run ${actorRunId} timed out after ${timeoutMs}ms`);
    }
    await sleep(pollMs);
    const pollRes = await fetchFn(`${APIFY_API}/actor-runs/${actorRunId}`, {
      headers: { Authorization: `Bearer ${opts.token}` },
    });
    const pollJson = (await pollRes.json()) as ApifyRunResponse;
    if (!pollRes.ok) {
      throw new Error(pollJson.error?.message || `Apify poll failed (${pollRes.status})`);
    }
    status = pollJson.data?.status ?? 'FAILED';
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${actorRunId} ended with status ${status}`);
  }

  const itemsRes = await fetchFn(`${APIFY_API}/datasets/${datasetId}/items?format=json&clean=1`, {
    headers: { Authorization: `Bearer ${opts.token}` },
  });
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset fetch failed (${itemsRes.status})`);
  }
  const items = (await itemsRes.json()) as ProviderJobRow[];
  if (!Array.isArray(items)) {
    throw new Error('Apify dataset did not return an array');
  }

  return { actorRunId, datasetId, status, items };
}
