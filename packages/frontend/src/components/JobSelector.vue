<script setup lang="ts">
import { computed } from 'vue';
import Select from 'primevue/select';
import type { ScrapeJob } from '@/lib/database.types';

const props = defineProps<{
  jobs: ScrapeJob[];
  modelValue: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

interface JobOption {
  label: string;
  value: string;
}

const finishedStatuses = new Set(['completed', 'failed', 'cancelled']);

const jobOptions = computed<JobOption[]>(() =>
  props.jobs
    .filter((j) => finishedStatuses.has(j.status))
    .map((j) => ({
      label: formatJobLabel(j),
      value: j.id,
    })),
);

function formatJobLabel(job: ScrapeJob): string {
  const queries = (job.search_queries ?? []).join(', ') || '(no queries)';
  const location = job.search_location;
  const count = job.businesses_discovered;
  const date = new Date(job.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${queries} — ${location} (${count} found) · ${date}`;
}

function onUpdate(value: string | null) {
  emit('update:modelValue', value);
}
</script>

<template>
  <Select
    :modelValue="modelValue"
    :options="jobOptions"
    optionLabel="label"
    optionValue="value"
    placeholder="All Searches"
    showClear
    class="job-selector"
    @update:modelValue="onUpdate"
  />
</template>

<style scoped>
.job-selector {
  min-width: 16rem;
  max-width: 28rem;
}
</style>
