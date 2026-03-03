<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import AppLayout from '@/components/AppLayout.vue';

const { user, loading } = useAuth();
</script>

<template>
  <div v-if="loading" class="loading-screen">
    <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
  </div>
  <AppLayout v-else-if="user">
    <router-view />
  </AppLayout>
  <router-view v-else />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  background: #f8f9fa;
  color: #1e293b;
  min-height: 100vh;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>
