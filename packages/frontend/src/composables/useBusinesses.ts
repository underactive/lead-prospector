import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Business, Campaign, ScrapeStatus } from '@/lib/database.types';

export function useBusinesses() {
  const businesses = ref<Business[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchBusinesses(filters?: {
    campaign?: Campaign;
    status?: ScrapeStatus;
    jobId?: string;
    minDistance?: number;
    maxDistance?: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      let query = supabase
        .from('businesses')
        .select('*')
        .order('distance_miles', { ascending: true });

      if (filters?.jobId) {
        query = query.eq('job_id', filters.jobId);
      }
      if (filters?.campaign) {
        query = query.eq('campaign', filters.campaign);
      }
      if (filters?.status) {
        query = query.eq('scrape_status', filters.status);
      }
      if (filters?.minDistance !== undefined) {
        query = query.gte('distance_miles', filters.minDistance);
      }
      if (filters?.maxDistance !== undefined) {
        query = query.lte('distance_miles', filters.maxDistance);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      businesses.value = data as Business[];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch businesses';
    } finally {
      loading.value = false;
    }
  }

  async function getBusiness(id: string): Promise<Business | null> {
    const { data, error: err } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();

    if (err) throw err;
    return data as Business;
  }

  async function deleteBusiness(id: string) {
    const { error: err } = await supabase.from('businesses').delete().eq('id', id);
    if (err) throw err;
    businesses.value = businesses.value.filter((b) => b.id !== id);
  }

  return { businesses, loading, error, fetchBusinesses, getBusiness, deleteBusiness };
}
