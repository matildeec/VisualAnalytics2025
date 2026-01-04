<script setup>
import { ref } from 'vue'
import VesselFilters from '../components/VesselFilters.vue'
import TrajectoryPlot from '../components/d3/TrajectoryPlot.vue'

const selectedVesselId1 = ref('')
const selectedVesselId2 = ref('')

function handleSelectSlot1(id) { selectedVesselId1.value = id }
function handleSelectSlot2(id) { selectedVesselId2.value = id }
</script>

<template>
  <div class="h-full flex flex-col bg-slate-100 overflow-hidden">
    
    <div class="m-8 mt-4 pb-4 flex-col flex lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200">
        <h1 class="text-lg font-bold tracking-tight uppercase">Compare Trajectories</h1>
        <span class="flex text-xs text-gray-400 gap-2 flex-end">
            <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4 inline-block" />
            Select two vessels to compare their trajectories over time.
        </span>
    </div>

    <div class="flex-grow flex flex-col lg:flex-row h-full min-h-0 m-4 mt-2 gap-2 rounded-2xl">
      
      <div class="flex-1 flex flex-col h-full min-w-0 bg-white relative group rounded-2xl">
        <VesselFilters 
          index="1" 
          colorClass="bg-blue-600" 
          @select="handleSelectSlot1" 
        />
        
        <div class="flex-grow relative bg-slate-50 overflow-hidden rounded-3xl">
          <div class="absolute inset-0">
             <TrajectoryPlot :selectedVesselId="selectedVesselId1" />
          </div>
          <div v-if="!selectedVesselId1" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center opacity-40">
              <p class="text-gray-400">Select Vessel 1</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col h-full min-w-0 bg-white relative group rounded-2xl">
        <VesselFilters 
          index="2" 
          colorClass="bg-amber-500" 
          @select="handleSelectSlot2" 
        />
        
        <div class="flex-grow relative bg-slate-50 overflow-hidden rounded-2xl">
          <div class="absolute inset-0">
             <TrajectoryPlot :selectedVesselId="selectedVesselId2" />
          </div>
           <div v-if="!selectedVesselId2" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center opacity-40">
              <p class="text-gray-400">Select Vessel 2</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>