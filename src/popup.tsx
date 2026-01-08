import { useState } from 'react';
import { ConfigForm } from './components/ConfigForm';
import { BuildResults } from './components/BuildResults';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdoClient } from './lib/ado-client';
import { Build, Artifact } from './types/ado';
import { PIPELINE_IDS } from './lib/constants';
import './index.css';

interface StageResult {
  stage: string;
  build: Build | null;
  artifacts: Artifact[];
  error?: string;
  loadingArtifacts?: boolean;
}

type BuildType = 'NB' | 'MTA' | 'Other';

function classifyStage2Build(build: Build | null): BuildType {
  if (!build) return 'Other';
  if (build.buildNumber.includes(' - NB - ')) return 'NB';
  if (build.buildNumber.includes(' - MTA&Cancellation - ')) return 'MTA';
  return 'Other';
}

function Popup() {
  const [stages, setStages] = useState<StageResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (config: {
    orgUrl: string;
    project: string;
    pat: string;
    buildId: string;
  }) => {
    setLoading(true);
    setStages([]);

    const client = new AdoClient();
    const pipelines = [
      { id: PIPELINE_IDS.STAGE_1, name: 'Stage 1', stage: 1 },
      { id: PIPELINE_IDS.STAGE_2, name: 'Stage 2', stage: 2 },
      { id: PIPELINE_IDS.STAGE_3, name: 'Stage 3', stage: 3 },
    ];

    const buildResults = await Promise.all(
      pipelines.map(async (pipeline) => {
        try {
          const build = await client.searchBuildsByName(
            config.orgUrl,
            config.project,
            pipeline.id,
            config.buildId,
            config.pat
          );

          return {
            stage: pipeline.name,
            stageNum: pipeline.stage,
            build,
            artifacts: [],
            loadingArtifacts: build !== null,
          };
        } catch (error) {
          return {
            stage: pipeline.name,
            stageNum: pipeline.stage,
            build: null,
            artifacts: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Expand Stage 2 into NB/MTA/Other
    const expandedResults = buildResults.flatMap((result) => {
      if (result.stageNum === 2 && result.build) {
        const buildType = classifyStage2Build(result.build);
        return [{
          ...result,
          stage: `Stage 2 - ${buildType}`,
        }];
      }
      return [result];
    });

    setStages(expandedResults);
    setLoading(false);

    // Fetch artifacts for found builds
    const artifactResults = await Promise.all(
      expandedResults.map(async (result) => {
        if (result.build) {
          try {
            const artifacts = await client.getArtifacts(
              config.orgUrl,
              config.project,
              result.build.id,
              config.pat
            );
            return {
              ...result,
              artifacts,
              loadingArtifacts: false,
            };
          } catch (error) {
            return {
              ...result,
              artifacts: [],
              loadingArtifacts: false,
            };
          }
        }
        return result;
      })
    );

    setStages(artifactResults);
  };

  return (
    <div className="w-[400px] min-h-[600px] p-4 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ADO Build Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Search for builds across multiple pipelines
        </p>
      </div>

      <ConfigForm onSubmit={handleSearch} loading={loading} />

      {stages.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Results</h2>
          <BuildResults stages={stages} loading={loading} />
        </div>
      )}

      <div className="pt-2 border-t">
        <a
          href="fullpage.html"
          target="_blank"
          className="text-sm text-primary hover:underline"
        >
          Open Full Page View
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  );
}

export default App;
