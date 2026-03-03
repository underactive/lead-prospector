<script setup lang="ts">
import { onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import { useJobs } from '@/composables/useJobs';
import JobProgress from '@/components/JobProgress.vue';
import type { ScrapeJob } from '@/lib/database.types';

const { jobs, loading, fetchJobs, cancelJob } = useJobs();

onMounted(fetchJobs);

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

async function handleCancel(job: ScrapeJob) {
  await cancelJob(job.id);
  await fetchJobs();
}
</script>

<template>
  <div class="jobs-page">
    <div class="page-header">
      <h1>Scraping Jobs</h1>
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        @click="fetchJobs"
      />
    </div>

    <div
      v-for="job in jobs.filter((j) => j.status === 'running' || j.status === 'pending')"
      :key="job.id"
      class="active-job"
    >
      <JobProgress :job="job" />
      <Button
        label="Cancel"
        icon="pi pi-times"
        severity="danger"
        size="small"
        outlined
        class="cancel-btn"
        @click="handleCancel(job)"
      />
    </div>

    <DataTable
      :value="jobs"
      :loading="loading"
      paginator
      :rows="20"
      sortField="created_at"
      :sortOrder="-1"
      stripedRows
      class="jobs-table"
    >
      <Column field="status" header="Status" sortable style="width: 100px">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column field="campaign" header="Campaign" sortable style="width: 100px" />
      <Column field="mode" header="Mode" sortable style="width: 80px" />
      <Column field="businesses_discovered" header="Discovered" sortable style="width: 110px" />
      <Column field="businesses_enriched" header="Enriched" sortable style="width: 100px" />
      <Column field="total_contacts" header="Contacts" sortable style="width: 100px" />
      <Column field="created_at" header="Created" sortable style="width: 180px">
        <template #body="{ data }">
          {{ formatDate(data.created_at) }}
        </template>
      </Column>
      <Column field="completed_at" header="Completed" sortable style="width: 180px">
        <template #body="{ data }">
          {{ formatDate(data.completed_at) }}
        </template>
      </Column>
      <Column header="" style="width: 60px">
        <template #body="{ data }">
          <Button
            v-if="data.status === 'running'"
            icon="pi pi-times"
            severity="danger"
            text
            rounded
            size="small"
            @click="handleCancel(data)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="empty-state">No jobs yet. Start a search from the Dashboard.</div>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.jobs-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.active-job {
  position: relative;
}

.cancel-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
}

.jobs-table {
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}
</style>
