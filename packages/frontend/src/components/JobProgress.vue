<script setup lang="ts">
import { computed, watch, onMounted, ref, nextTick } from 'vue';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import { useRealtime } from '@/composables/useRealtime';
import type { ScrapeJob } from '@/lib/database.types';

const props = defineProps<{
  job: ScrapeJob;
}>();

const emit = defineEmits<{
  'job-updated': [job: ScrapeJob];
}>();

const { activeJob, subscribeToJob } = useRealtime();

const currentJob = computed(() => activeJob.value ?? props.job);
const logExpanded = ref(true);
const logContainer = ref<HTMLElement | null>(null);

const logLines = computed(() => {
  const raw = currentJob.value.log;
  if (!raw) return [];
  return raw.split('\n').filter((l) => l.length > 0);
});

const progress = computed(() => {
  const j = currentJob.value;
  if (j.status === 'completed') return 100;
  if (j.businesses_discovered === 0) return 5;
  const enrichProgress = j.businesses_discovered > 0
    ? (j.businesses_enriched / j.businesses_discovered) * 100
    : 0;
  return Math.min(Math.round(enrichProgress), 99);
});

function statusSeverity(status: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'warn';
    case 'failed':
      return 'danger';
    default:
      return 'secondary';
  }
}

// Notify parent when job data changes so it can refresh businesses
watch(activeJob, (job) => {
  if (job) emit('job-updated', job);
});

// Auto-scroll log to bottom when new lines arrive
watch(logLines, async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

onMounted(() => {
  if (props.job.status === 'running' || props.job.status === 'pending') {
    subscribeToJob(props.job.id);
  }
});

watch(
  () => props.job.id,
  (id) => {
    subscribeToJob(id);
  }
);
</script>

<template>
  <div class="job-progress">
    <div class="job-header">
      <Tag :value="currentJob.status" :severity="statusSeverity(currentJob.status)" />
      <span class="job-campaign">{{ currentJob.campaign }}</span>
      <span class="job-mode">{{ currentJob.mode }}</span>
    </div>

    <ProgressBar
      :value="progress"
      :showValue="true"
      class="progress-bar"
    />

    <div class="job-stats">
      <div class="stat">
        <span class="stat-value">{{ currentJob.businesses_discovered }}</span>
        <span class="stat-label">Discovered</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ currentJob.businesses_enriched }}</span>
        <span class="stat-label">Enriched</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ currentJob.businesses_failed }}</span>
        <span class="stat-label">Failed</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ currentJob.total_contacts }}</span>
        <span class="stat-label">Contacts</span>
      </div>
    </div>

    <div v-if="logLines.length > 0" class="log-section">
      <button class="log-toggle" @click="logExpanded = !logExpanded">
        <span class="log-toggle-icon">{{ logExpanded ? '▾' : '▸' }}</span>
        Log Output
        <span class="log-line-count">{{ logLines.length }} lines</span>
      </button>
      <div v-show="logExpanded" ref="logContainer" class="log-container">
        <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <div v-if="currentJob.error" class="job-error">
      {{ currentJob.error }}
    </div>
  </div>
</template>

<style scoped>
.job-progress {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}

.job-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.job-campaign,
.job-mode {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
}

.progress-bar {
  margin-bottom: 0.75rem;
}

.job-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.stat-label {
  font-size: 0.6875rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.log-section {
  margin-top: 0.75rem;
}

.log-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.log-toggle:hover {
  color: #0f172a;
}

.log-toggle-icon {
  font-size: 0.625rem;
}

.log-line-count {
  font-weight: 400;
  color: #94a3b8;
  margin-left: 0.25rem;
}

.log-container {
  margin-top: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
  background: #0f172a;
  border-radius: 6px;
  padding: 0.75rem;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.6875rem;
  line-height: 1.5;
}

.log-line {
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
}

.job-error {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.8125rem;
}
</style>
