import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { ScrapeJob, ScrapeMode } from '@/lib/database.types';

export function useJobs() {
  const jobs = ref<ScrapeJob[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchJobs() {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase
        .from('scrape_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      jobs.value = data as ScrapeJob[];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch jobs';
    } finally {
      loading.value = false;
    }
  }

  async function createAndStartJob(params: {
    campaign: 'local' | 'remote';
    mode: ScrapeMode;
    maxRadiusMiles: number;
    minRadiusMiles?: number;
    searchLocation: string;
    searchLat: number;
    searchLng: number;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: job, error: err } = await supabase
      .from('scrape_jobs')
      .insert({
        user_id: user.id,
        campaign: params.campaign,
        mode: params.mode,
        min_radius_miles: params.minRadiusMiles ?? 0,
        max_radius_miles: params.maxRadiusMiles,
        search_location: params.searchLocation,
        search_lat: params.searchLat,
        search_lng: params.searchLng,
      })
      .select()
      .single();

    if (err) throw err;

    const response = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        userId: user.id,
        campaign: params.campaign,
        mode: params.mode,
        searchLocation: params.searchLocation,
        searchLat: params.searchLat,
        searchLng: params.searchLng,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to start scraper: ${text}`);
    }

    return job as ScrapeJob;
  }

  async function cancelJob(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to cancel job');
    }
  }

  return { jobs, loading, error, fetchJobs, createAndStartJob, cancelJob };
}
