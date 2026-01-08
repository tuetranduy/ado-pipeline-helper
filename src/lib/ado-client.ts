import { Build, Artifact } from '../types/ado';

export class AdoClient {
  private encodeAuth(pat: string): string {
    return btoa(`:${pat}`);
  }

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new Error('Organization URL must use HTTPS protocol');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTPS')) {
        throw error;
      }
      throw new Error('Invalid organization URL format. Expected: https://dev.azure.com/yourorg');
    }
  }

  async searchBuildsByName(
    orgUrl: string,
    project: string,
    pipelineId: string,
    buildId: string,
    pat: string,
    buildTypeFilter?: string | null
  ): Promise<Build | null> {
    try {
      this.validateUrl(orgUrl);
      const cleanOrgUrl = orgUrl.replace(/\/$/, '');
      const apiUrl = `${cleanOrgUrl}/${project}/_apis/build/builds?definitions=${pipelineId}&api-version=7.2-preview.8&statusFilter=all`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${this.encodeAuth(pat)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Check your PAT token.');
        } else if (response.status === 404) {
          throw new Error('Project or pipeline not found.');
        } else if (response.status === 429) {
          throw new Error('Azure DevOps rate limit exceeded. Please wait and try again.');
        }
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      const builds = data.value || [];

      const buildIdPattern = /(\d+)$/;
      const match = buildId.match(buildIdPattern);
      const searchId = match ? match[1] : buildId;

      // Match builds where the final numeric segment equals the search ID
      // Return the most recent match (builds are typically sorted by date descending)
      for (const build of builds) {
        const buildMatch = build.buildNumber.match(buildIdPattern);
        if (buildMatch && buildMatch[1] === searchId) {
          if (buildTypeFilter && !build.buildNumber.includes(buildTypeFilter)) {
            continue;
          }
          return {
            id: build.id,
            buildNumber: build.buildNumber,
            name: build.definition?.name,
            url: `${cleanOrgUrl}/${project}/_build/results?buildId=${build.id}`,
            status: build.status,
            result: build.result,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error searching builds:', error);
      if (error instanceof Error) {
        throw error;
      }
      return null;
    }
  }

  async getArtifacts(
    orgUrl: string,
    project: string,
    buildId: number,
    pat: string
  ): Promise<Artifact[]> {
    try {
      this.validateUrl(orgUrl);
      const cleanOrgUrl = orgUrl.replace(/\/$/, '');
      const apiUrl = `${cleanOrgUrl}/${project}/_apis/build/builds/${buildId}/artifacts?api-version=7.0`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${this.encodeAuth(pat)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Check your PAT token.');
        } else if (response.status === 404) {
          throw new Error('Build not found.');
        } else if (response.status === 429) {
          throw new Error('Azure DevOps rate limit exceeded. Please wait and try again.');
        }
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      return [];
    }
  }

  async getBuildById(
    orgUrl: string,
    project: string,
    buildId: number,
    pat: string
  ): Promise<Build | null> {
    try {
      this.validateUrl(orgUrl);
      const cleanOrgUrl = orgUrl.replace(/\/$/, '');
      const apiUrl = `${cleanOrgUrl}/${project}/_apis/build/builds/${buildId}?api-version=7.2-preview.8`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${this.encodeAuth(pat)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Check your PAT token.');
        } else if (response.status === 404) {
          return null;
        } else if (response.status === 429) {
          throw new Error('Azure DevOps rate limit exceeded. Please wait and try again.');
        }
        throw new Error(`API call failed: ${response.status}`);
      }

      const build = await response.json();
      return {
        id: build.id,
        buildNumber: build.buildNumber,
        name: build.definition?.name,
        url: `${cleanOrgUrl}/${project}/_build/results?buildId=${build.id}`,
        status: build.status,
        result: build.result,
      };
    } catch (error) {
      console.error('Error fetching build by ID:', error);
      if (error instanceof Error) {
        throw error;
      }
      return null;
    }
  }
}
