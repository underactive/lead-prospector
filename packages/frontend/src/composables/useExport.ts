import { ref } from 'vue';
import { supabase } from '@/lib/supabase';

export function useExport() {
  const exporting = ref(false);
  const error = ref<string | null>(null);

  async function exportCsv(filters?: { campaign?: string; status?: string }) {
    exporting.value = true;
    error.value = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters?.campaign) params.set('campaign', filters.campaign);
      if (filters?.status) params.set('status', filters.status);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-csv?${params}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'leads-export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exporting.value = false;
    }
  }

  return { exporting, error, exportCsv };
}
