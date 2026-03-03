<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import type { Contact } from '@/lib/database.types';

defineProps<{
  contacts: Contact[];
  loading: boolean;
}>();

function confidenceSeverity(confidence: string) {
  switch (confidence) {
    case 'high':
      return 'success';
    case 'medium':
      return 'warn';
    case 'low':
      return 'danger';
    default:
      return 'secondary';
  }
}
</script>

<template>
  <DataTable
    :value="contacts"
    :loading="loading"
    stripedRows
    class="contacts-table"
  >
    <Column field="name" header="Name" sortable />
    <Column field="title" header="Title" sortable>
      <template #body="{ data }">
        {{ data.title || '—' }}
      </template>
    </Column>
    <Column field="email" header="Email" sortable>
      <template #body="{ data }">
        <a v-if="data.email" :href="`mailto:${data.email}`">{{ data.email }}</a>
        <span v-else>—</span>
      </template>
    </Column>
    <Column field="phone" header="Phone">
      <template #body="{ data }">
        {{ data.phone || '—' }}
      </template>
    </Column>
    <Column field="seniority_score" header="Score" sortable style="width: 80px" />
    <Column field="confidence" header="Confidence" sortable style="width: 110px">
      <template #body="{ data }">
        <Tag :value="data.confidence" :severity="confidenceSeverity(data.confidence)" />
      </template>
    </Column>
    <Column field="source" header="Source" style="width: 100px">
      <template #body="{ data }">
        {{ data.source || '—' }}
      </template>
    </Column>
    <template #empty>
      <div class="empty-state">No contacts found for this business.</div>
    </template>
  </DataTable>
</template>

<style scoped>
.contacts-table {
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  padding: 1.5rem;
  color: #94a3b8;
}
</style>
