<script setup lang="ts">
import Button from 'primevue/button';
import { useExport } from '@/composables/useExport';

defineProps<{
  campaign?: string;
}>();

const { exporting, error, exportCsv } = useExport();
</script>

<template>
  <div class="export-wrapper">
    <Button
      label="Export CSV"
      icon="pi pi-download"
      :loading="exporting"
      severity="secondary"
      size="small"
      @click="exportCsv({ campaign })"
    />
    <span v-if="error" class="export-error">{{ error }}</span>
  </div>
</template>

<style scoped>
.export-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.export-error {
  font-size: 0.75rem;
  color: #dc2626;
}
</style>
