<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useBusinesses } from '@/composables/useBusinesses';
import { useContacts } from '@/composables/useContacts';
import ContactsList from '@/components/ContactsList.vue';
import type { Business } from '@/lib/database.types';

const route = useRoute();
const router = useRouter();
const { getBusiness, deleteBusiness } = useBusinesses();
const { contacts, loading: contactsLoading, fetchContactsForBusiness } = useContacts();

const business = ref<Business | null>(null);
const loading = ref(true);
const enriching = ref(false);

onMounted(async () => {
  const id = route.params.id as string;
  try {
    business.value = await getBusiness(id);
    if (business.value) {
      await fetchContactsForBusiness(business.value.id);
    }
  } finally {
    loading.value = false;
  }
});

async function handleEnrich() {
  if (!business.value) return;
  enriching.value = true;
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${supabaseUrl}/functions/v1/enrich-single`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ businessId: business.value.id }),
    });

    if (response.ok) {
      business.value = await getBusiness(business.value!.id);
      if (business.value) {
        await fetchContactsForBusiness(business.value.id);
      }
    }
  } finally {
    enriching.value = false;
  }
}

async function handleDelete() {
  if (!business.value) return;
  await deleteBusiness(business.value.id);
  router.push('/');
}

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
</script>

<template>
  <div v-if="loading" class="loading">
    <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem"></i>
  </div>

  <div v-else-if="!business" class="not-found">
    <p>Business not found.</p>
    <Button label="Back to Dashboard" icon="pi pi-arrow-left" @click="router.push('/')" />
  </div>

  <div v-else class="business-detail">
    <div class="detail-header">
      <Button
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        rounded
        @click="router.push('/')"
      />
      <div class="header-info">
        <h1>{{ business.name }}</h1>
        <div class="header-meta">
          <Tag :value="business.campaign" :severity="business.campaign === 'local' ? 'success' : 'info'" />
          <Tag :value="business.scrape_status" :severity="statusSeverity(business.scrape_status)" />
          <span v-if="business.distance_miles != null" class="distance">
            {{ business.distance_miles.toFixed(1) }} mi away
          </span>
        </div>
      </div>
      <div class="header-actions">
        <Button
          label="Enrich"
          icon="pi pi-refresh"
          size="small"
          :loading="enriching"
          @click="handleEnrich"
        />
        <Button
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          outlined
          @click="handleDelete"
        />
      </div>
    </div>

    <div class="detail-grid">
      <div class="info-card">
        <h3>Details</h3>
        <div class="info-row" v-if="business.address">
          <span class="info-label">Address</span>
          <span>{{ business.address }}, {{ business.city }}, {{ business.state }} {{ business.zip }}</span>
        </div>
        <div class="info-row" v-if="business.phone">
          <span class="info-label">Phone</span>
          <span>{{ business.phone }}</span>
        </div>
        <div class="info-row" v-if="business.website">
          <span class="info-label">Website</span>
          <a :href="business.website" target="_blank" rel="noopener noreferrer">{{ business.website }}</a>
        </div>
        <div class="info-row" v-if="business.linkedin_url">
          <span class="info-label">LinkedIn</span>
          <a :href="business.linkedin_url" target="_blank" rel="noopener noreferrer">{{ business.linkedin_url }}</a>
        </div>
        <div class="info-row" v-if="business.google_maps_url">
          <span class="info-label">Google Maps</span>
          <a :href="business.google_maps_url" target="_blank" rel="noopener noreferrer">View on Maps</a>
        </div>
        <div class="info-row" v-if="business.rating">
          <span class="info-label">Rating</span>
          <span>{{ business.rating }} ({{ business.review_count }} reviews)</span>
        </div>
      </div>

      <div class="contacts-card">
        <h3>Contacts</h3>
        <ContactsList :contacts="contacts" :loading="contactsLoading" />
      </div>
    </div>

    <div v-if="business.scrape_error" class="error-banner">
      <strong>Scrape Error:</strong> {{ business.scrape_error }}
    </div>
  </div>
</template>

<style scoped>
.loading,
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  color: #64748b;
}

.business-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.header-info {
  flex: 1;
}

.header-info h1 {
  font-size: 1.375rem;
  font-weight: 700;
  color: #0f172a;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.distance {
  font-size: 0.8125rem;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
}

.info-card,
.contacts-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
}

.info-card h3,
.contacts-card h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.625rem;
}

.info-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  font-weight: 600;
}

.info-row a {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.875rem;
  word-break: break-all;
}

.info-row a:hover {
  text-decoration: underline;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.8125rem;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
