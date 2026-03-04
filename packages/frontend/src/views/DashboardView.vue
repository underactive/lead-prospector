<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import { useBusinesses } from '@/composables/useBusinesses';
import { useJobs } from '@/composables/useJobs';
import SearchControls from '@/components/SearchControls.vue';
import LeadsTable from '@/components/LeadsTable.vue';
import LeadsMap from '@/components/LeadsMap.vue';
import ExportButton from '@/components/ExportButton.vue';
import JobProgress from '@/components/JobProgress.vue';
import JobSelector from '@/components/JobSelector.vue';
import type { ScrapeJob } from '@/lib/database.types';

const router = useRouter();
const { businesses, loading: businessesLoading, fetchBusinesses } = useBusinesses();
const { jobs, fetchJobs, createAndStartJob, cancelJob } = useJobs();

const activeJobId = ref<string | null>(null);
const selectedJobId = ref<string | null>(null);
const mapCenter = ref<[number, number]>([30.2672, -97.7431]);
const radiusRange = ref<[number, number]>([0, 100]);

const totalBusinesses = computed(() => businesses.value.length);
const localBusinesses = computed(() => businesses.value.filter((b) => b.campaign === 'local').length);
const remoteBusinesses = computed(() => businesses.value.filter((b) => b.campaign === 'remote').length);
const enrichedBusinesses = computed(() => businesses.value.filter((b) => b.scrape_status === 'enriched').length);

const runningJob = computed<ScrapeJob | null>(() =>
  jobs.value.find((j) => j.status === 'running' || j.status === 'pending') ?? null
);

function refreshBusinesses() {
  fetchBusinesses(selectedJobId.value ? { jobId: selectedJobId.value } : undefined);
}

watch(selectedJobId, (jobId) => {
  refreshBusinesses();
  if (jobId) {
    const job = jobs.value.find((j) => j.id === jobId);
    if (job) {
      mapCenter.value = [job.search_lat, job.search_lng];
    }
  }
});

// Track last known count to avoid redundant fetches
let lastBusinessCount = 0;

function handleJobUpdated(job: ScrapeJob) {
  const newCount = job.businesses_discovered + job.businesses_enriched;
  if (newCount !== lastBusinessCount || job.status === 'completed') {
    lastBusinessCount = newCount;
    refreshBusinesses();
  }
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    activeJobId.value = null;
    if (job.status === 'completed') {
      selectedJobId.value = job.id;
    }
    fetchJobs();
  }
}

async function handleCancel() {
  if (runningJob.value) {
    try {
      await cancelJob(runningJob.value.id);
      activeJobId.value = null;
      await fetchJobs();
    } catch (e) {
      console.error('Failed to cancel job:', e);
    }
  }
}

onMounted(async () => {
  await Promise.all([fetchBusinesses(), fetchJobs()]);
});

async function handleSearch(params: {
  campaign: 'local' | 'remote';
  mode: 'api' | 'scrape';
  maxRadius: number;
  minRadius: number;
  location: string;
  lat: number;
  lng: number;
  searchQueries: string[];
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
      searchQueries: params.searchQueries,
    });
    activeJobId.value = job.id;
    lastBusinessCount = 0;
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
        <div class="stat-number">{{ totalBusinesses }}</div>
        <div class="stat-label">Total Businesses</div>
      </div>
      <div class="stat-card stat-local">
        <div class="stat-number">{{ localBusinesses }}</div>
        <div class="stat-label">Local</div>
      </div>
      <div class="stat-card stat-remote">
        <div class="stat-number">{{ remoteBusinesses }}</div>
        <div class="stat-label">Remote</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ enrichedBusinesses }}</div>
        <div class="stat-label">Enriched</div>
      </div>
    </div>

    <SearchControls :scraping="!!runningJob" @search="handleSearch" @cancel="handleCancel" @update:radius-range="radiusRange = $event" @update:center="mapCenter = $event" />

    <JobProgress v-if="runningJob" :job="runningJob" @job-updated="handleJobUpdated" />

    <div class="content-grid">
      <div class="map-section">
        <LeadsMap :businesses="businesses" :center="mapCenter" :radius-range="radiusRange" />
      </div>
      <div class="table-section">
        <div class="table-header">
          <h2>Leads</h2>
          <JobSelector v-model="selectedJobId" :jobs="jobs" />
          <ExportButton :jobId="selectedJobId" />
        </div>
        <LeadsTable :businesses="businesses" :loading="businessesLoading" />
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
