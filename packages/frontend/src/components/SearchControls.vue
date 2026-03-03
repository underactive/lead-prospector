<script setup lang="ts">
import { ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import Select from 'primevue/select';

const emit = defineEmits<{
  search: [params: { campaign: 'local' | 'remote'; mode: 'api' | 'scrape'; maxRadius: number; minRadius: number; location: string; lat: number; lng: number }];
  'update:radiusRange': [value: [number, number]];
}>();

const location = ref('Austin, TX');
const radiusRange = ref<[number, number]>([0, 10]);
const campaign = ref<'local' | 'remote'>('local');
const mode = ref<'api' | 'scrape'>('api');
const geocoding = ref(false);
const geocodeError = ref<string | null>(null);

// Cache geocoded results to avoid re-fetching for the same location
const geocodeCache = ref<Record<string, { lat: number; lng: number }>>({
  'Austin, TX': { lat: 30.2672, lng: -97.7431 },
});

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number }> {
  const normalized = query.trim();
  if (geocodeCache.value[normalized]) {
    return geocodeCache.value[normalized];
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalized)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LeadProspector/1.0' },
  });

  if (!res.ok) throw new Error('Geocoding request failed');

  const data = await res.json();
  if (!data.length) throw new Error(`Could not find location: "${normalized}"`);

  const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  geocodeCache.value[normalized] = result;
  return result;
}

const modeOptions = [
  { label: 'Scrape Mode', value: 'scrape' as const },
  { label: 'API Mode', value: 'api' as const },
];

watch(radiusRange, (val) => {
  emit('update:radiusRange', val as [number, number]);
}, { immediate: true });

function setLocalPreset() {
  campaign.value = 'local';
  radiusRange.value = [0, 10];
}

function setRemotePreset() {
  campaign.value = 'remote';
  radiusRange.value = [25, 100];
}

async function handleSearch() {
  geocoding.value = true;
  geocodeError.value = null;

  try {
    const coords = await geocodeLocation(location.value);
    emit('search', {
      campaign: campaign.value,
      mode: mode.value,
      minRadius: radiusRange.value[0],
      maxRadius: radiusRange.value[1],
      location: location.value.trim(),
      lat: coords.lat,
      lng: coords.lng,
    });
  } catch (e) {
    geocodeError.value = e instanceof Error ? e.message : 'Geocoding failed';
  } finally {
    geocoding.value = false;
  }
}

</script>

<template>
  <div class="search-controls">
    <div class="controls-row">
      <div class="field">
        <label>Location</label>
        <InputText v-model="location" placeholder="Austin, TX" class="location-input" />
      </div>

      <div class="field">
        <label>Mode</label>
        <Select v-model="mode" :options="modeOptions" optionLabel="label" optionValue="value" class="mode-select" />
      </div>
    </div>

    <div class="controls-row">
      <div class="field slider-field">
        <label>Radius: {{ radiusRange[0] }} - {{ radiusRange[1] }} mi</label>
        <Slider v-model="radiusRange" range :min="0" :max="100" class="radius-slider" />
      </div>

      <div class="preset-buttons">
        <Button label="Local Leads" icon="pi pi-map-marker" severity="success" size="small" outlined @click="setLocalPreset" />
        <Button label="Remote Leads" icon="pi pi-send" severity="info" size="small" outlined @click="setRemotePreset" />
      </div>

      <div class="action-buttons">
        <Button label="New Search" icon="pi pi-search" size="small" :loading="geocoding" @click="handleSearch" />
      </div>
    </div>

    <div v-if="geocodeError" class="geocode-error">
      {{ geocodeError }}
    </div>
  </div>
</template>

<style scoped>
.search-controls {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.controls-row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slider-field {
  flex: 1;
  min-width: 200px;
}

.radius-slider {
  margin-top: 0.5rem;
}

.location-input {
  width: 180px;
}

.mode-select {
  width: 180px;
}

.preset-buttons,
.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.geocode-error {
  color: #dc2626;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}
</style>
