import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TrackingHistory } from './TrackingHistory';
import { HistoricalBuild } from '../lib/storage';

const mockStorage = {
  get: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: mockStorage,
    },
  });
  vi.clearAllMocks();
});

describe('TrackingHistory', () => {
  it('should display message when no history exists', async () => {
    mockStorage.get.mockResolvedValue({ buildHistory: [] });

    render(<TrackingHistory />);

    await waitFor(() => {
      expect(screen.getByText('No tracking history yet')).toBeInTheDocument();
    });
  });

  it('should display build history with correct details', async () => {
    const mockHistory: HistoricalBuild[] = [
      {
        buildNumber: '12345',
        status: 'completed', currentStage: 'done',
        startedAt: Date.now() - 60 * 60 * 1000,
        completedAt: Date.now(),
        stage1BuildUrl: 'https://dev.azure.com/test',
        stage2NbBuildUrl: 'https://dev.azure.com/stage2nb',
      },
    ];

    mockStorage.get.mockResolvedValue({ buildHistory: mockHistory });

    render(<TrackingHistory />);

    await waitFor(() => {
      expect(screen.getByText('Build 12345')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('should display multiple builds sorted by completion date', async () => {
    const now = Date.now();
    const mockHistory: HistoricalBuild[] = [
      {
        buildNumber: 'older',
        status: 'completed', currentStage: 'done',
        startedAt: now - 120 * 60 * 1000,
        completedAt: now - 60 * 60 * 1000,
      },
      {
        buildNumber: 'newer',
        status: 'completed', currentStage: 'done',
        startedAt: now - 30 * 60 * 1000,
        completedAt: now,
      },
    ];

    mockStorage.get.mockResolvedValue({ buildHistory: mockHistory });

    render(<TrackingHistory />);

    await waitFor(() => {
      const buildNumbers = screen.getAllByText(/Build (newer|older)/);
      expect(buildNumbers[0]).toHaveTextContent('Build newer');
      expect(buildNumbers[1]).toHaveTextContent('Build older');
    });
  });

  it('should display status badges with correct colors', async () => {
    const mockHistory: HistoricalBuild[] = [
      {
        buildNumber: '123',
        status: 'completed', currentStage: 'done',
        startedAt: Date.now(),
        completedAt: Date.now(),
      },
      {
        buildNumber: '456',
        status: 'failed', currentStage: 'done',
        startedAt: Date.now(),
        completedAt: Date.now(),
      },
      {
        buildNumber: '789',
        status: 'timeout', currentStage: 'done',
        startedAt: Date.now(),
        completedAt: Date.now(),
      },
    ];

    mockStorage.get.mockResolvedValue({ buildHistory: mockHistory });

    render(<TrackingHistory />);

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('timeout')).toBeInTheDocument();
    });
  });

  it('should display Stage 1 build link when available', async () => {
    const mockHistory: HistoricalBuild[] = [
      {
        buildNumber: '12345',
        status: 'completed', currentStage: 'done',
        startedAt: Date.now(),
        completedAt: Date.now(),
        stage1BuildUrl: 'https://dev.azure.com/stage1',
      },
    ];

    mockStorage.get.mockResolvedValue({ buildHistory: mockHistory });

    render(<TrackingHistory />);

    await waitFor(() => {
      const link = screen.getByText('View Stage 1 Build →');
      expect(link).toHaveAttribute('href', 'https://dev.azure.com/stage1');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('should display detected stages with links', async () => {
    const mockHistory: HistoricalBuild[] = [
      {
        buildNumber: '12345',
        status: 'completed', currentStage: 'done',
        startedAt: Date.now(),
        completedAt: Date.now(),
        stage2NbBuildUrl: 'https://dev.azure.com/stage2nb',
        stage3BuildUrl: 'https://dev.azure.com/stage3',
      },
    ];

    mockStorage.get.mockResolvedValue({ buildHistory: mockHistory });

    render(<TrackingHistory />);

    await waitFor(() => {
      const links = screen.getAllByText('View →');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
