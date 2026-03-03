<script setup lang="ts">
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import type { Firm } from '@/lib/database.types';

defineProps<{
  firms: Firm[];
  loading: boolean;
}>();

const router = useRouter();

function statusSeverity(status: string) {
  switch (status) {
    case 'enriched':
      return 'success';
    case 'enriching':
      return 'warn';
    case 'failed':
      return 'danger';
    default:
      return 'secondary';
  }
}

function campaignSeverity(campaign: string) {
  switch (campaign) {
    case 'local':
      return 'success';
    case 'remote':
      return 'info';
    default:
      return 'secondary';
  }
}

function onRowClick(event: { data: Firm }) {
  router.push(`/firms/${event.data.id}`);
}
</script>

<template>
  <DataTable
    :value="firms"
    :loading="loading"
    paginator
    :rows="50"
    :rowsPerPageOptions="[25, 50, 100]"
    sortField="distance_miles"
    :sortOrder="1"
    stripedRows
    class="leads-table"
    selectionMode="single"
    @row-click="onRowClick"
    :rowHover="true"
  >
    <Column field="name" header="Name" sortable style="min-width: 200px" />
    <Column field="address" header="Address" sortable style="min-width: 180px">
      <template #body="{ data }">
        {{ data.address || '—' }}
      </template>
    </Column>
    <Column field="distance_miles" header="Distance" sortable style="width: 100px">
      <template #body="{ data }">
        {{ data.distance_miles != null ? `${data.distance_miles.toFixed(1)} mi` : '—' }}
      </template>
    </Column>
    <Column field="campaign" header="Campaign" sortable style="width: 100px">
      <template #body="{ data }">
        <Tag :value="data.campaign" :severity="campaignSeverity(data.campaign)" />
      </template>
    </Column>
    <Column field="website" header="Website" style="width: 80px">
      <template #body="{ data }">
        <a
          v-if="data.website"
          :href="data.website"
          target="_blank"
          rel="noopener noreferrer"
          class="link-icon"
        >
          <i class="pi pi-external-link"></i>
        </a>
        <span v-else>—</span>
      </template>
    </Column>
    <Column field="linkedin_url" header="LinkedIn" style="width: 80px">
      <template #body="{ data }">
        <a
          v-if="data.linkedin_url"
          :href="data.linkedin_url"
          target="_blank"
          rel="noopener noreferrer"
          class="link-icon"
        >
          <i class="pi pi-linkedin"></i>
        </a>
        <span v-else>—</span>
      </template>
    </Column>
    <Column field="rating" header="Rating" sortable style="width: 80px">
      <template #body="{ data }">
        {{ data.rating != null ? `${data.rating} (${data.review_count})` : '—' }}
      </template>
    </Column>
    <Column field="scrape_status" header="Status" sortable style="width: 110px">
      <template #body="{ data }">
        <Tag :value="data.scrape_status" :severity="statusSeverity(data.scrape_status)" />
      </template>
    </Column>
    <template #empty>
      <div class="empty-state">No firms found. Run a search to discover leads.</div>
    </template>
  </DataTable>
</template>

<style scoped>
.leads-table {
  font-size: 0.875rem;
}

.link-icon {
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s;
}

.link-icon:hover {
  color: #0f172a;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}
</style>
