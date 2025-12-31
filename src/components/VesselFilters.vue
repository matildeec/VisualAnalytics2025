<template>
  <div class="flex flex-col h-full max-w-full overflow-hidden">
    <div class="flex items-center gap-2 mb-2">
      <div 
        v-if="index" 
        :class="[badgeBgColor, 'w-5 h-5 text-white text-[10px] font-bold rounded-sm flex items-center justify-center shrink-0 shadow-sm']"
      >
        {{ index }}
      </div>
      <h2 v-if="title" class="text-[11px] font-bold text-gray-500 uppercase tracking-tight truncate">
        {{ title }}
      </h2>
    </div>

    <div class="flex flex-col gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
      
      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Company</label>
        <select v-model="selectedCompany" @change="onCompanyChange" class="filter-select">
          <option value="">All Companies</option>
          <option v-for="c in companies" :key="c">{{ c }}</option>
        </select>
      </div>

      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Type</label>
        <select v-model="selectedType" @change="onTypeChange" class="filter-select">
          <option value="">All Types</option>
          <option v-for="t in vesselTypes" :key="t">{{ t }}</option>
        </select>
      </div>

      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Tonnage</label>
        <select v-model="selectedTonnage" @change="onTonnageChange" class="filter-select">
          <option value="">All Tonnages</option>
          <option v-for="t in tonnages" :key="t">{{ t }}</option>
        </select>
      </div>

      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Vessel Name</label>
        <select 
          v-model="selectedVessel" 
          @change="$emit('select', selectedVessel)" 
          class="filter-select bg-blue-50/50 border-blue-200"
        >
          <option value="">Select Vessel...</option>
          <option v-for="v in vessels" :key="v.id" :value="v.id">
            {{ v.name }}
          </option>
        </select>
      </div>

      <button 
        @click="resetFilters"
        class="mt-1 w-full py-1 text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-blue-500 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear Selection
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  index: { type: [Number, String], default: null }
})

const emit = defineEmits(['select'])

// Dynamic Badge Colors based on index
const badgeBgColor = computed(() => {
  const idx = String(props.index)
  if (idx === '1') return 'bg-red-500'
  if (idx === '2') return 'bg-indigo-500'
  return 'bg-gray-400'
})

const selectedCompany = ref('')
const selectedType = ref('')
const selectedTonnage = ref('')
const selectedVessel = ref('')

const companies = ref([])
const vesselTypes = ref([])
const tonnages = ref([])
const vessels = ref([])
const allVessels = ref([])

function filterOptions() {
  let filtered = allVessels.value
  
  // Apply active filters
  if (selectedCompany.value) filtered = filtered.filter(v => v.company === selectedCompany.value)
  if (selectedType.value) filtered = filtered.filter(v => v.vessel_type === selectedType.value)
  if (selectedTonnage.value) filtered = filtered.filter(v => v.tonnage === Number(selectedTonnage.value))
  
  // Sort and populate dropdown arrays
  companies.value = [...new Set(filtered.map(v => v.company))].sort()
  vesselTypes.value = [...new Set(filtered.map(v => v.vessel_type))].sort()
  tonnages.value = [...new Set(filtered.map(v => v.tonnage))].sort((a, b) => a - b)
  
  // Standard alphabetical sort for vessels
  vessels.value = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
}

function resetFilters() {
  selectedCompany.value = ''
  selectedType.value = ''
  selectedTonnage.value = ''
  selectedVessel.value = ''
  filterOptions()
  emit('select', '') // Notify parent that selection is cleared
}

function onCompanyChange() {
  selectedType.value = ''; selectedTonnage.value = ''; selectedVessel.value = '';
  filterOptions()
}
function onTypeChange() {
  selectedTonnage.value = ''; selectedVessel.value = '';
  filterOptions()
}
function onTonnageChange() {
  selectedVessel.value = '';
  filterOptions()
}

onMounted(async () => {
  try {
    const vesselsRes = await fetch('data/vessels.json')
    allVessels.value = await vesselsRes.json()
    filterOptions()
  } catch (err) {
    console.error("Failed to load vessels:", err)
  }
})
</script>

<style scoped>
.filter-select {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border-width: 1px;
  border-color: #d1d5db;
  background-color: #f9fafb;
  font-size: 11px;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.filter-select:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 1px #60a5fa;
  outline: none;
}

option {
  font-size: 12px;
  color: #374151;
}
</style>