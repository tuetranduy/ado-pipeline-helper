import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { PipelineConfig } from '../types/ado';

interface ConfigFormProps {
  onSubmit: (config: PipelineConfig & { buildId: string; pipelineIds: { stage1: string; stage2: string; stage3: string } }) => void;
  loading: boolean;
}

export function ConfigForm({ onSubmit, loading }: ConfigFormProps) {
  const [orgUrl, setOrgUrl] = useState('');
  const [project, setProject] = useState('');
  const [pat, setPat] = useState('');
  const [buildId, setBuildId] = useState('');
  const [pipelineIds, setPipelineIds] = useState({ stage1: '', stage2: '', stage3: '' });

  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    chrome.storage.local.get(
      ['orgUrl', 'project', 'pat', 'buildId', 'pipelineIds'],
      (result: any) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load settings:', chrome.runtime.lastError);
          return;
        }
        if (result.orgUrl) setOrgUrl(result.orgUrl);
        if (result.project) setProject(result.project);
        if (result.pat) setPat(result.pat);
        if (result.buildId) setBuildId(result.buildId);
        if (result.pipelineIds) setPipelineIds(result.pipelineIds);
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
      pipelineIds,
    });
  };

  const isValid =
    orgUrl.trim() !== '' &&
    project.trim() !== '' &&
    pat.trim() !== '' &&
    buildId.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="buildId">Build Number(s)</Label>
        <Input
          id="buildId"
          type="text"
          placeholder="e.g., 86951 or 86951, 86952, 86953"
          value={buildId}
          onChange={(e) => {
            const value = e.target.value;
            setBuildId(value);
            handleDebouncedSave('buildId', value);
          }}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Enter one or more build numbers separated by commas (e.g., 86951, 86952).
        </p>
        <i className="text-xs text-muted-foreground">
          (Full Page view only)
        </i>
      </div>

      <Button type="submit" disabled={!isValid || loading} className="w-full">
        {loading ? 'Searching...' : 'Search Builds'}
      </Button>
    </form>
  );
}
