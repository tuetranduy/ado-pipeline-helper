import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdoClient } from './ado-client';

(globalThis as any).fetch = vi.fn();

describe('AdoClient', () => {
  let client: AdoClient;

  beforeEach(() => {
    client = new AdoClient();
    vi.clearAllMocks();
  });

  describe('searchBuildsByName', () => {
    it('should extract build ID from build number and return matching build', async () => {
      const mockBuilds = {
        value: [
          {
            id: 123,
            buildNumber: 'Pipeline - 86951',
            definition: { name: 'Test Pipeline' },
            status: 'completed',
          },
        ],
      };

      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds,
      });

      const result = await client.searchBuildsByName(
        'https://dev.azure.com/org',
        'project',
        '1',
        '86951',
        'pat123'
      );

      expect(result).toEqual({
        id: 123,
        buildNumber: 'Pipeline - 86951',
        name: 'Test Pipeline',
        url: 'https://dev.azure.com/org/project/_build/results?buildId=123',
        status: 'completed',
      });
    });

    it('should handle 401 authentication error', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(
        client.searchBuildsByName(
          'https://dev.azure.com/org',
          'project',
          '1',
          '86951',
          'invalid-pat'
        )
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle 429 rate limit error', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(
        client.searchBuildsByName(
          'https://dev.azure.com/org',
          'project',
          '1',
          '86951',
          'pat123'
        )
      ).rejects.toThrow('rate limit exceeded');
    });

    it('should return null when no matching build found', async () => {
      const mockBuilds = {
        value: [
          {
            id: 123,
            buildNumber: 'Pipeline - 99999',
            status: 'completed',
          },
        ],
      };

      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds,
      });

      const result = await client.searchBuildsByName(
        'https://dev.azure.com/org',
        'project',
        '1',
        '86951',
        'pat123'
      );

      expect(result).toBeNull();
    });
  });

  describe('getArtifacts', () => {
    it('should fetch artifacts for a build', async () => {
      const mockArtifacts = {
        value: [
          {
            id: 1,
            name: 'drop',
            resource: {
              downloadUrl: 'https://example.com/artifact.zip',
            },
          },
        ],
      };

      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockArtifacts,
      });

      const result = await client.getArtifacts(
        'https://dev.azure.com/org',
        'project',
        123,
        'pat123'
      );

      expect(result).toEqual(mockArtifacts.value);
    });

    it('should return empty array on error', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getArtifacts(
        'https://dev.azure.com/org',
        'project',
        123,
        'pat123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getBuildById', () => {
    it('should fetch build by ID and return build details', async () => {
      const mockBuild = {
        id: 123,
        buildNumber: 'Pipeline - 86951',
        definition: { name: 'Test Pipeline' },
        status: 'completed',
        result: 'succeeded',
      };

      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuild,
      });

      const result = await client.getBuildById(
        'https://dev.azure.com/org',
        'project',
        123,
        'pat123'
      );

      expect(result).toEqual({
        id: 123,
        buildNumber: 'Pipeline - 86951',
        name: 'Test Pipeline',
        url: 'https://dev.azure.com/org/project/_build/results?buildId=123',
        status: 'completed',
        result: 'succeeded',
      });
    });

    it('should return null when build not found (404)', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getBuildById(
        'https://dev.azure.com/org',
        'project',
        123,
        'pat123'
      );

      expect(result).toBeNull();
    });

    it('should handle 401 authentication error', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(
        client.getBuildById(
          'https://dev.azure.com/org',
          'project',
          123,
          'invalid-pat'
        )
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle 429 rate limit error', async () => {
      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(
        client.getBuildById(
          'https://dev.azure.com/org',
          'project',
          123,
          'pat123'
        )
      ).rejects.toThrow('rate limit exceeded');
    });
  });

  describe('Base64 encoding', () => {
    it('should correctly encode PAT for Basic auth', async () => {
      const mockBuilds = { value: [] };

      ((globalThis as any).fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds,
      });

      await client.searchBuildsByName(
        'https://dev.azure.com/org',
        'project',
        '1',
        '86951',
        'mytoken'
      );

      const callArgs = ((globalThis as any).fetch as any).mock.calls[0];
      const authHeader = callArgs[1].headers.Authorization;
      
      expect(authHeader).toMatch(/^Basic /);
      const decoded = atob(authHeader.replace('Basic ', ''));
      expect(decoded).toBe(':mytoken');
    });
  });
});
