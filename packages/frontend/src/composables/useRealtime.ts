import { ref, onUnmounted } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ScrapeJob } from '@/lib/database.types';

export function useRealtime() {
  const activeJob = ref<ScrapeJob | null>(null);
  let channel: RealtimeChannel | null = null;

  function subscribeToJob(jobId: string) {
    unsubscribe();

    channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scrape_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          activeJob.value = payload.new as ScrapeJob;
        }
      )
      .subscribe();
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }

  onUnmounted(unsubscribe);

  return { activeJob, subscribeToJob, unsubscribe };
}
