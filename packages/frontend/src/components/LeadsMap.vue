<script setup lang="ts">
import { computed } from 'vue';
import {
  LMap,
  LTileLayer,
  LMarker,
  LPopup,
  LCircle,
} from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Business } from '@/lib/database.types';

const props = withDefaults(
  defineProps<{
    businesses: Business[];
    center?: [number, number];
    radiusRange?: [number, number];
  }>(),
  {
    center: () => [30.2672, -97.7431] as [number, number],
    radiusRange: () => [0, 100] as [number, number],
  }
);

const MILES_TO_METERS = 1609.34;

const mapBusinesses = computed(() =>
  props.businesses.filter((b) => b.latitude != null && b.longitude != null)
);

function markerColor(campaign: string) {
  switch (campaign) {
    case 'local':
      return '#22c55e';
    case 'remote':
      return '#3b82f6';
    default:
      return '#94a3b8';
  }
}
</script>

<template>
  <div class="map-container">
    <LMap :key="center.join(',')" :zoom="10" :center="center" :useGlobalLeaflet="false" style="height: 100%; width: 100%">
      <LTileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <!-- Inner radius circle (min) -->
      <LCircle
        v-if="radiusRange[0] > 0"
        :lat-lng="center"
        :radius="radiusRange[0] * MILES_TO_METERS"
        color="#94a3b8"
        :fillOpacity="0.04"
        :weight="1"
        :dashArray="'4, 4'"
      />

      <!-- Outer radius circle (max) -->
      <LCircle
        :lat-lng="center"
        :radius="radiusRange[1] * MILES_TO_METERS"
        color="#3b82f6"
        :fillOpacity="0.05"
        :weight="2"
      />

      <LMarker
        v-for="business in mapBusinesses"
        :key="business.id"
        :lat-lng="[business.latitude!, business.longitude!]"
      >
        <LPopup>
          <div class="popup-content">
            <strong>{{ business.name }}</strong>
            <div v-if="business.distance_miles != null" class="popup-distance">
              {{ business.distance_miles.toFixed(1) }} mi away
            </div>
            <div v-if="business.address" class="popup-address">{{ business.address }}</div>
            <div v-if="business.phone" class="popup-phone">{{ business.phone }}</div>
          </div>
        </LPopup>
      </LMarker>
    </LMap>
  </div>
</template>

<style scoped>
.map-container {
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.popup-content {
  font-size: 0.8125rem;
  line-height: 1.4;
}

.popup-distance {
  color: #64748b;
  font-size: 0.75rem;
}

.popup-address,
.popup-phone {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.125rem;
}
</style>
