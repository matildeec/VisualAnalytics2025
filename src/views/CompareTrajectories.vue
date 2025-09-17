<script setup>
import { ref } from 'vue'
import VesselFilters from '../components/VesselFilters.vue'
import TrajectoryPlot from '../components/d3/TrajectoryPlot.vue'

// defines a reactive variable to hold the selected vessel ID
const selectedVesselId = ref('')

// updates the selected vessel ID when VesselFilters emits a 'select' event
function handleVesselSelect(id) {
  selectedVesselId.value = id
}
</script>

<template>
  <div class="m-8 pb-4 flex-col flex lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200">
    <h1 class="text-xl font-bold">Trajectory Analysis</h1>
    <span class="flex text-xs text-gray-400 gap-2 flex-end">
      <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4 inline-block" />
      Reconstructed trajectories with dwell times, harbor reports and associated cargo. Interact for more information.
    </span>
  </div>
  <div class="px-8 py-8 lg:px-16 lg:py-12">
    
    <VesselFilters @select="handleVesselSelect" />

    <div class="mt-8">
      <TrajectoryPlot :selectedVesselId="selectedVesselId" />
    </div>
  </div>
</template>

<style scoped>
h1 {
  color: var(--main-deep-blue);
  text-transform: uppercase;
}
</style>
