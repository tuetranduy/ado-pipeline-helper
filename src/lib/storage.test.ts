import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTrackedBuilds,
  saveTrackedBuild,
  removeTrackedBuild,
  getBuildHistory,
  addToHistory,
  pruneHistory,
  TrackedBuild,
} from './storage';

const mockStorage = {
  data: {} as Record<string, unknown>,
  get: vi.fn((keys: string | string[]) => {
    const result: Record<string, unknown> = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];
    keyArray.forEach((key) => {
      if (key in mockStorage.data) {
        result[key] = mockStorage.data[key];
      }
    });
    return Promise.resolve(result);
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(mockStorage.data, items);
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    mockStorage.data = {};
    return Promise.resolve();
  }),
};

beforeEach(() => {
  mockStorage.data = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: mockStorage,
    },
  });
});

describe('storage utilities', () => {
  describe('getTrackedBuilds', () => {
    it('should return empty map when no builds exist', async () => {
      const builds = await getTrackedBuilds();
      expect(builds.size).toBe(0);
    });

    it('should return map of tracked builds', async () => {
      const testBuild: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now(),
      };
      mockStorage.data.trackedBuilds = { '12345': testBuild };

      const builds = await getTrackedBuilds();
      expect(builds.size).toBe(1);
      expect(builds.get('12345')).toEqual(testBuild);
    });
  });

  describe('saveTrackedBuild', () => {
    it('should save a new tracked build', async () => {
      const testBuild: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now(),
      };

      await saveTrackedBuild('12345', testBuild);

      expect(mockStorage.set).toHaveBeenCalledWith({
        trackedBuilds: { '12345': testBuild },
      });
    });

    it('should update existing tracked build', async () => {
      const initialBuild: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now(),
      };
      mockStorage.data.trackedBuilds = { '12345': initialBuild };

      const updatedBuild: TrackedBuild = {
        ...initialBuild,
        status: 'monitoring_stage2_nb',
        currentStage: 'stage2_nb',
      };

      await saveTrackedBuild('12345', updatedBuild);

      const builds = await getTrackedBuilds();
      expect(builds.get('12345')?.status).toBe('monitoring_stage2_nb');
    });
  });

  describe('removeTrackedBuild', () => {
    it('should remove a tracked build', async () => {
      const testBuild: TrackedBuild = {
        buildNumber: '12345',
        status: 'completed',
        currentStage: 'done',
        startedAt: Date.now(),
      };
      mockStorage.data.trackedBuilds = { '12345': testBuild };

      await removeTrackedBuild('12345');

      const builds = await getTrackedBuilds();
      expect(builds.size).toBe(0);
    });
  });

  describe('getBuildHistory', () => {
    it('should return empty array when no history exists', async () => {
      const history = await getBuildHistory();
      expect(history).toEqual([]);
    });

    it('should return build history', async () => {
      const testHistory = [
        {
          buildNumber: '12345',
          status: 'completed' as const,
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      ];
      mockStorage.data.buildHistory = testHistory;

      const history = await getBuildHistory();
      expect(history).toEqual(testHistory);
    });
  });

  describe('addToHistory', () => {
    it('should add build to history', async () => {
      const testBuild: TrackedBuild = {
        buildNumber: '12345',
        status: 'completed',
        currentStage: 'done',
        startedAt: Date.now(),
      };

      await addToHistory(testBuild);

      const history = await getBuildHistory();
      expect(history.length).toBe(1);
      expect(history[0].buildNumber).toBe('12345');
      expect(history[0].completedAt).toBeDefined();
    });
  });

  describe('pruneHistory', () => {
    it('should remove builds older than 30 days', async () => {
      const oldDate = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const recentDate = Date.now();

      mockStorage.data.buildHistory = [
        {
          buildNumber: 'old',
          status: 'completed' as const,
          startedAt: oldDate,
          completedAt: oldDate,
        },
        {
          buildNumber: 'recent',
          status: 'completed' as const,
          startedAt: recentDate,
          completedAt: recentDate,
        },
      ];

      await pruneHistory();

      const history = await getBuildHistory();
      expect(history.length).toBe(1);
      expect(history[0].buildNumber).toBe('recent');
    });
  });
});
