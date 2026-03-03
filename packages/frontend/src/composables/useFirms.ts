import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Firm, Campaign, ScrapeStatus } from '@/lib/database.types';

export function useFirms() {
  const firms = ref<Firm[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFirms(filters?: {
    campaign?: Campaign;
    status?: ScrapeStatus;
    minDistance?: number;
    maxDistance?: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      let query = supabase
        .from('firms')
        .select('*')
        .order('distance_miles', { ascending: true });

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
      firms.value = data as Firm[];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch firms';
    } finally {
      loading.value = false;
    }
  }

  async function getFirm(id: string): Promise<Firm | null> {
    const { data, error: err } = await supabase
      .from('firms')
      .select('*')
      .eq('id', id)
      .single();

    if (err) throw err;
    return data as Firm;
  }

  async function deleteFirm(id: string) {
    const { error: err } = await supabase.from('firms').delete().eq('id', id);
    if (err) throw err;
    firms.value = firms.value.filter((f) => f.id !== id);
  }

  return { firms, loading, error, fetchFirms, getFirm, deleteFirm };
}
