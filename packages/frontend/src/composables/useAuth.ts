import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const session = ref<Session | null>(null);
const user = computed<User | null>(() => session.value?.user ?? null);
const loading = ref(true);

let initialized = false;
let subscription: { unsubscribe: () => void } | null = null;

function init() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session;
    loading.value = false;
  });

  const { data } = supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, newSession: Session | null) => {
      session.value = newSession;
      loading.value = false;
    }
  );
  subscription = data.subscription;
}

export function useAuth() {
  onMounted(init);

  async function signInWithProvider(provider: 'github' | 'google' | 'discord') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    session.value = null;
  }

  return {
    session,
    user,
    loading,
    signInWithProvider,
    signOut,
  };
}
