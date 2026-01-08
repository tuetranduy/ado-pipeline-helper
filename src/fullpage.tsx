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

function FullPage() {
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
    <div className="container max-w-4xl mx-auto p-8 space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">ADO Build Tracker</h1>
        <p className="text-muted-foreground">
          Search for builds across multiple Azure DevOps pipelines and download artifacts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ConfigForm onSubmit={handleSearch} loading={loading} />
        </div>

        <div className="lg:col-span-2">
          {stages.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Results</h2>
              <BuildResults stages={stages} loading={loading} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Enter search criteria and click "Search Builds" to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <FullPage />
    </ErrorBoundary>
  );
}

export default App;
