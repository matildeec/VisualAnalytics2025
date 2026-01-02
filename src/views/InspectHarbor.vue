<script setup>
import { ref } from 'vue'
import HarborActivityChart from '../components/d3/HarborActivityChart.vue'

const selectedHarbor = ref('')
const availableHarbors = ref([])

const handleHarborsLoaded = (harbors) => {
  availableHarbors.value = harbors
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-50">
    <div class="m-8 mt-4 pb-4 flex-col flex justify-between lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200 shrink-0">
      
      <div class="flex flex-row gap-2">
        <h1 class="text-lg font-bold tracking-tight uppercase">Harbor Activity</h1>
        <div class="flex items-center text-xs text-gray-400 gap-2">
          <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4" />
          <span>Daily cargo departure and vessel arrivals. Filter by harbor to investigate local trends.</span>
        </div>
      </div>

      <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
        <label class="text-[10px] font-bold uppercase text-gray-400 whitespace-nowrap">Select Harbor</label>
        <select 
          v-model="selectedHarbor"
          class="text-sm font-medium bg-transparent border-none focus:ring-0 cursor-pointer min-w-[200px] text-slate-700"
        >
          <option disabled value="">Choose a location...</option>
          <option v-for="h in availableHarbors" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>
    </div>
  
    <div class="flex-grow p-6 flex flex-col relative overflow-hidden">
      
      <div v-if="!selectedHarbor" class="absolute inset-0 z-20 m-6 flex flex-col items-center justify-center bg-white backdrop-blur-[2px] rounded-xl border border-gray-100 shadow-sm transition-all">
        <p class="text-gray-400">Select a harbor from the list above</p>
      </div>

      <div class="flex-grow min-h-0">
        <HarborActivityChart 
          :selected-harbor="selectedHarbor" 
          @harbors-loaded="handleHarborsLoaded" 
          class="h-full"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
</style>