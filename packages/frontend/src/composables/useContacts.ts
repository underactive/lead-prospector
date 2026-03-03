import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/lib/database.types';

export function useContacts() {
  const contacts = ref<Contact[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchContactsForBusiness(businessId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase
        .from('contacts')
        .select('*')
        .eq('business_id', businessId)
        .order('seniority_score', { ascending: false });

      if (err) throw err;
      contacts.value = data as Contact[];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch contacts';
    } finally {
      loading.value = false;
    }
  }

  return { contacts, loading, error, fetchContactsForBusiness };
}
