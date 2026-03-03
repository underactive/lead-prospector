<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';

const { user, signOut } = useAuth();
const router = useRouter();

async function handleSignOut() {
  await signOut();
  router.push('/login');
}
</script>

<template>
  <div class="app-layout">
    <header class="topbar">
      <div class="topbar-left">
        <router-link to="/" class="brand">Lead Prospector</router-link>
      </div>
      <nav class="topbar-nav">
        <router-link to="/" class="nav-link">Dashboard</router-link>
        <router-link to="/jobs" class="nav-link">Jobs</router-link>
      </nav>
      <div class="topbar-right">
        <span class="user-email">{{ user?.email }}</span>
        <Button
          label="Sign Out"
          icon="pi pi-sign-out"
          severity="secondary"
          text
          size="small"
          @click="handleSignOut"
        />
      </div>
    </header>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.topbar-left {
  flex-shrink: 0;
}

.brand {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  text-decoration: none;
  letter-spacing: -0.025em;
}

.topbar-nav {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.nav-link {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  transition: all 0.15s;
}

.nav-link:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.nav-link.router-link-active {
  color: #0f172a;
  background: #f1f5f9;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.user-email {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.main-content {
  flex: 1;
  padding: 1.5rem;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
}
</style>
