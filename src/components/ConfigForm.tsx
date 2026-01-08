import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { PipelineConfig } from '../types/ado';
import { PIPELINE_IDS } from '../lib/constants';

interface ConfigFormProps {
  onSubmit: (config: PipelineConfig & { buildId: string; pipelineIds: { stage1: string; stage2: string; stage3: string } }) => void;
  loading: boolean;
}

export function ConfigForm({ onSubmit, loading }: ConfigFormProps) {
  const [orgUrl, setOrgUrl] = useState('');
  const [project, setProject] = useState('');
  const [pat, setPat] = useState('');
  const [buildId, setBuildId] = useState('');
  const [pipelineStage1, setPipelineStage1] = useState<string>(PIPELINE_IDS.STAGE_1);
  const [pipelineStage2, setPipelineStage2] = useState<string>(PIPELINE_IDS.STAGE_2);
  const [pipelineStage3, setPipelineStage3] = useState<string>(PIPELINE_IDS.STAGE_3);

  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    chrome.storage.local.get(
      ['orgUrl', 'project', 'pat', 'buildId'],
      (result: any) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load settings:', chrome.runtime.lastError);
          return;
        }
        if (result.orgUrl) setOrgUrl(result.orgUrl);
        if (result.project) setProject(result.project);
        if (result.pat) setPat(result.pat);
        if (result.buildId) setBuildId(result.buildId);
      }
    );

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const saveToStorage = useCallback((key: string, value: string) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save setting:', chrome.runtime.lastError);
      }
    });
  }, []);

  const handleDebouncedSave = useCallback((key: string, value: string) => {
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
    }
    timersRef.current[key] = setTimeout(() => {
      saveToStorage(key, value);
      delete timersRef.current[key];
    }, 500);
  }, [saveToStorage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      orgUrl,
      project,
      pat,
      buildId,
      pipelineIds: {
        stage1: pipelineStage1,
        stage2: pipelineStage2,
        stage3: pipelineStage3,
      },
    });
  };

  const isValid =
    orgUrl.trim() !== '' &&
    project.trim() !== '' &&
    pat.trim() !== '' &&
    buildId.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Settings</h3>
        
        <div className="space-y-2">
          <Label htmlFor="orgUrl">Organization URL</Label>
          <Input
            id="orgUrl"
            type="url"
            placeholder="https://dev.azure.com/yourorg"
            value={orgUrl}
            onChange={(e) => {
              const value = e.target.value;
              setOrgUrl(value);
              handleDebouncedSave('orgUrl', value);
            }}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Input
            id="project"
            type="text"
            placeholder="MyProject"
            value={project}
            onChange={(e) => {
              const value = e.target.value;
              setProject(value);
              handleDebouncedSave('project', value);
            }}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pat">Personal Access Token</Label>
          <Input
            id="pat"
            type="password"
            placeholder="PAT"
            value={pat}
            onChange={(e) => {
              const value = e.target.value;
              setPat(value);
              handleDebouncedSave('pat', value);
            }}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <h3 className="font-semibold text-sm">Pipeline IDs</h3>

        <div className="space-y-2">
          <Label htmlFor="pipelineStage1">Stage 1 Pipeline ID</Label>
          <Input
            id="pipelineStage1"
            type="text"
            placeholder="747"
            value={pipelineStage1}
            onChange={(e) => {
              const value = e.target.value;
              setPipelineStage1(value);
              handleDebouncedSave('pipelineStage1', value);
            }}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pipelineStage2">Stage 2 Pipeline ID</Label>
          <Input
            id="pipelineStage2"
            type="text"
            placeholder="712"
            value={pipelineStage2}
            onChange={(e) => {
              const value = e.target.value;
              setPipelineStage2(value);
              handleDebouncedSave('pipelineStage2', value);
            }}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pipelineStage3">Stage 3 Pipeline ID</Label>
          <Input
            id="pipelineStage3"
            type="text"
            placeholder="1172"
            value={pipelineStage3}
            onChange={(e) => {
              const value = e.target.value;
              setPipelineStage3(value);
              handleDebouncedSave('pipelineStage3', value);
            }}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <h3 className="font-semibold text-sm">Query</h3>

        <div className="space-y-2">
          <Label htmlFor="buildId">Build ID</Label>
          <Input
            id="buildId"
            type="text"
            placeholder="86951"
            value={buildId}
            onChange={(e) => {
              const value = e.target.value;
              setBuildId(value);
              handleDebouncedSave('buildId', value);
            }}
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" disabled={!isValid || loading} className="w-full">
        {loading ? 'Searching...' : 'Search Builds'}
      </Button>
    </form>
  );
}
