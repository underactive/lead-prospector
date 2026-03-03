<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import { useAuth } from '@/composables/useAuth';

const { signInWithProvider, session } = useAuth();
const router = useRouter();

onMounted(() => {
  if (session.value) {
    router.replace('/');
  }
});
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">Lead Prospector</h1>
      <p class="login-subtitle">
        Find business leads near you or across the globe. Sign in to get started with your prospecting journey. ⛏️
      </p>
      <div class="login-buttons">
        <Button
          label="Continue with GitHub"
          icon="pi pi-github"
          severity="secondary"
          outlined
          class="login-btn"
          @click="signInWithProvider('github')"
        />
        <Button
          label="Continue with Google"
          icon="pi pi-google"
          severity="secondary"
          outlined
          class="login-btn"
          @click="signInWithProvider('google')"
        />
        <Button
          label="Continue with Discord"
          icon="pi pi-discord"
          severity="secondary"
          outlined
          class="login-btn"
          @click="signInWithProvider('discord')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f8f9fa;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  padding: 3rem 2.5rem;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.04);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.login-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 2rem;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-btn {
  width: 100%;
  justify-content: center;
}
</style>
