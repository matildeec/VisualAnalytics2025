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
    <div class="mx-8 mt-6 pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between border-b-2 border-gray-200 gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight">Harbor Activity</h1>
        <div class="flex items-center text-xs text-gray-400 gap-2">
          <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4" />
          <span>Daily cargo departure and vessel arrivals. Filter by harbor to investigate local trends.</span>
        </div>
      </div>

      <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
        <label class="text-[10px] font-bold uppercase text-gray-400 whitespace-nowrap">Select Harbor</label>
        <select 
          v-model="selectedHarbor"
          class="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer min-w-[200px] text-slate-700"
        >
          <option disabled value="">Choose a location...</option>
          <option v-for="h in availableHarbors" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>
    </div>
  
    <div class="flex-grow p-6 flex flex-col relative overflow-hidden">
      
      <div v-if="!selectedHarbor" class="absolute inset-0 z-20 m-6 flex flex-col items-center justify-center bg-gray-50/90 backdrop-blur-[2px] rounded-2xl border-2 border-dashed border-gray-300 transition-all">
        <p class="text-gray-400 font-medium uppercase tracking-widest text-sm">Select a harbor from the list above</p>
      </div>

      <div class="flex-grow bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <HarborActivityChart 
          :selected-harbor="selectedHarbor" 
          @harbors-loaded="handleHarborsLoaded" 
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
h1 {
  /* Using your design tokens */
  color: var(--main-deep-blue, #1e3a8a);
  text-transform: uppercase;
}

/* Custom dropdown arrow for a cleaner look */
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