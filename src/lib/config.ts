export interface TrackerConfig {
  stage1IntervalMinutes: number;
  stage1MaxAttempts: number;
  delayAfterStage1Minutes: number;
  pollingIntervalMinutes: number;
  pollingMaxAttempts: number;
}

const DEFAULT_CONFIG: TrackerConfig = {
  stage1IntervalMinutes: 2,
  stage1MaxAttempts: 60,
  delayAfterStage1Minutes: 20,
  pollingIntervalMinutes: 5,
  pollingMaxAttempts: 24,
};

export async function getTrackerConfig(): Promise<TrackerConfig> {
  const result = await chrome.storage.local.get('trackerConfig');
  return { ...DEFAULT_CONFIG, ...(result.trackerConfig || {}) };
}

export async function saveTrackerConfig(config: Partial<TrackerConfig>): Promise<void> {
  const current = await getTrackerConfig();
  const updated = { ...current, ...config };
  await chrome.storage.local.set({ trackerConfig: updated });
}
