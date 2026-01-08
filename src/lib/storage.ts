export interface TrackedBuild {
  buildNumber: string;
  status: 'monitoring_stage1' | 'waiting_stage2_nb' | 'monitoring_stage2_nb' | 'monitoring_stage3' | 'waiting_stage2_mta' | 'monitoring_stage2_mta' | 'completed' | 'failed' | 'timeout';
  currentStage: 'stage1' | 'stage2_nb' | 'stage3' | 'stage2_mta' | 'done';
  stage1BuildId?: number;
  stage1BuildUrl?: string;
  stage1BuildName?: string;
  stage1BuildStatus?: string;
  stage1BuildResult?: string;
  stage2NbBuildId?: number;
  stage2NbBuildUrl?: string;
  stage3BuildId?: number;
  stage3BuildUrl?: string;
  stage2MtaBuildId?: number;
  stage2MtaBuildUrl?: string;
  startedAt: number;
  stage1CompletedAt?: number;
  stage2NbCompletedAt?: number;
  stage3CompletedAt?: number;
  stage2MtaCompletedAt?: number;
}

export interface HistoricalBuild extends TrackedBuild {
  completedAt: number;
}

const STORAGE_KEYS = {
  TRACKED_BUILDS: 'trackedBuilds',
  BUILD_HISTORY: 'buildHistory',
} as const;

const MAX_HISTORY_DAYS = 30;

export async function getTrackedBuilds(): Promise<Map<string, TrackedBuild>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TRACKED_BUILDS);
  const data = result[STORAGE_KEYS.TRACKED_BUILDS] || {};
  return new Map(Object.entries(data));
}

export async function saveTrackedBuild(buildNumber: string, build: TrackedBuild): Promise<void> {
  const builds = await getTrackedBuilds();
  builds.set(buildNumber, build);
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRACKED_BUILDS]: Object.fromEntries(builds),
  });
}

export async function removeTrackedBuild(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  builds.delete(buildNumber);
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRACKED_BUILDS]: Object.fromEntries(builds),
  });
}

export async function getBuildHistory(): Promise<HistoricalBuild[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BUILD_HISTORY);
  return (result[STORAGE_KEYS.BUILD_HISTORY] || []) as HistoricalBuild[];
}

export async function addToHistory(build: TrackedBuild): Promise<void> {
  const history = await getBuildHistory();
  const historicalBuild: HistoricalBuild = {
    ...build,
    completedAt: Date.now(),
  };
  history.push(historicalBuild);
  
  const cutoffTime = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const prunedHistory = history.filter((b) => b.completedAt > cutoffTime);
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.BUILD_HISTORY]: prunedHistory,
  });
}

export async function pruneHistory(): Promise<void> {
  const history = await getBuildHistory();
  const cutoffTime = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const prunedHistory = history.filter((build) => build.completedAt > cutoffTime);
  await chrome.storage.local.set({
    [STORAGE_KEYS.BUILD_HISTORY]: prunedHistory,
  });
}
