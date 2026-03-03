<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import { useFirms } from '@/composables/useFirms';
import { useJobs } from '@/composables/useJobs';
import SearchControls from '@/components/SearchControls.vue';
import LeadsTable from '@/components/LeadsTable.vue';
import LeadsMap from '@/components/LeadsMap.vue';
import ExportButton from '@/components/ExportButton.vue';
import JobProgress from '@/components/JobProgress.vue';
import type { ScrapeJob } from '@/lib/database.types';

const router = useRouter();
const { firms, loading: firmsLoading, fetchFirms } = useFirms();
const { jobs, fetchJobs, createAndStartJob } = useJobs();

const activeJobId = ref<string | null>(null);
const mapCenter = ref<[number, number]>([30.2672, -97.7431]);
const radiusRange = ref<[number, number]>([0, 100]);

const totalFirms = computed(() => firms.value.length);
const localFirms = computed(() => firms.value.filter((f) => f.campaign === 'local').length);
const remoteFirms = computed(() => firms.value.filter((f) => f.campaign === 'remote').length);
const enrichedFirms = computed(() => firms.value.filter((f) => f.scrape_status === 'enriched').length);

const runningJob = computed<ScrapeJob | null>(() =>
  jobs.value.find((j) => j.status === 'running' || j.status === 'pending') ?? null
);

// Track last known count to avoid redundant fetches
let lastFirmCount = 0;

function handleJobUpdated(job: ScrapeJob) {
  const newCount = job.firms_discovered + job.firms_enriched;
  if (newCount !== lastFirmCount || job.status === 'completed') {
    lastFirmCount = newCount;
    fetchFirms();
  }
  if (job.status === 'completed' || job.status === 'failed') {
    fetchJobs();
  }
}

onMounted(async () => {
  await Promise.all([fetchFirms(), fetchJobs()]);
});

async function handleSearch(params: {
  campaign: 'local' | 'remote';
  mode: 'api' | 'scrape';
  maxRadius: number;
  minRadius: number;
  location: string;
  lat: number;
  lng: number;
}) {
  try {
    mapCenter.value = [params.lat, params.lng];
    const job = await createAndStartJob({
      campaign: params.campaign,
      mode: params.mode,
      maxRadiusMiles: params.maxRadius,
      minRadiusMiles: params.minRadius,
      searchLocation: params.location,
      searchLat: params.lat,
      searchLng: params.lng,
    });
    activeJobId.value = job.id;
    await fetchJobs();
  } catch (e) {
    console.error('Failed to start search:', e);
  }
}

</script>

<template>
  <div class="dashboard">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">{{ totalFirms }}</div>
        <div class="stat-label">Total Firms</div>
      </div>
      <div class="stat-card stat-local">
        <div class="stat-number">{{ localFirms }}</div>
        <div class="stat-label">Local</div>
      </div>
      <div class="stat-card stat-remote">
        <div class="stat-number">{{ remoteFirms }}</div>
        <div class="stat-label">Remote</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ enrichedFirms }}</div>
        <div class="stat-label">Enriched</div>
      </div>
    </div>

    <SearchControls @search="handleSearch" @update:radius-range="radiusRange = $event" />

    <JobProgress v-if="runningJob" :job="runningJob" @job-updated="handleJobUpdated" />

    <div class="content-grid">
      <div class="map-section">
        <LeadsMap :firms="firms" :center="mapCenter" :radius-range="radiusRange" />
      </div>
      <div class="table-section">
        <div class="table-header">
          <h2>Leads</h2>
          <ExportButton />
        </div>
        <LeadsTable :firms="firms" :loading="firmsLoading" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.stat-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.stat-number {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
}

.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.125rem;
}

.stat-local .stat-number {
  color: #16a34a;
}

.stat-remote .stat-number {
  color: #2563eb;
}

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.map-section {
  width: 100%;
}

.table-section {
  width: 100%;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.table-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}
</style>
