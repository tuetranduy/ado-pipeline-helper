export interface Build {
  id: number;
  buildNumber: string;
  name?: string;
  url: string;
  status: string;
}

export interface Artifact {
  id: number;
  name: string;
  resource: {
    downloadUrl: string;
  };
}

export interface PipelineConfig {
  orgUrl: string;
  project: string;
  pat: string;
}

export interface SearchParams extends PipelineConfig {
  buildId: string;
}
