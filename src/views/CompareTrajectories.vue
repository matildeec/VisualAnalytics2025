<script setup>
import { ref } from 'vue'
import VesselFilters from '../components/VesselFilters.vue'
import TrajectoryPlot from '../components/d3/TrajectoryPlot.vue'

// Reactive variables to catch selected vessel IDs
const selectedVesselId1 = ref('')
const selectedVesselId2 = ref('')

// Handlers to update selected vessel IDs
function handleSelectSlot1(id) { selectedVesselId1.value = id }
function handleSelectSlot2(id) { selectedVesselId2.value = id }
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-100">
    
    <div class="m-8 mt-4 pb-4 flex-col flex lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200">
      <h1 class="text-lg font-bold tracking-tight uppercase">Trajectory Comparison</h1>
      <span class="flex text-xs text-gray-400 gap-2 flex-end">
        <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4 inline-block" />
        Compare the trajectories of two vessels side by side. Select vessels from the filters to visualize their paths.
      </span>
    </div>

    <div class="flex-grow p-4 flex flex-col gap-2 overflow-hidden">
      
      <div class="flex-1 bg-gray-50/50 p-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full items-stretch">
          <div class="lg:col-span-1 border-r border-gray-200 pr-4">
            <VesselFilters title="Vessel Selection" index="1" @select="handleSelectSlot1" />
          </div>
          <div class="lg:col-span-3 bg-white rounded border border-gray-200 overflow-hidden h-full relative">
            <TrajectoryPlot :selectedVesselId="selectedVesselId1" />
          </div>
        </div>
      </div>

      <div class="flex-1 bg-gray-50/50 p-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full items-stretch">
          <div class="lg:col-span-1 border-r border-gray-200 pr-4">
            <VesselFilters title="Vessel Selection" index="2" @select="handleSelectSlot2" />
          </div>
          <div class="lg:col-span-3 bg-white rounded border border-gray-200 overflow-hidden h-full relative">
            <TrajectoryPlot :selectedVesselId="selectedVesselId2" />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
