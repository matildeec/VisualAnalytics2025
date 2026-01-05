<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'

const props = defineProps({
  index: { type: [Number, String], required: true }
})

const emit = defineEmits(['select'])

const isExpanded = ref(true)
const vessels = ref([])
const allVessels = ref([])

// Filter states are reactive because we want to watch them for changes immediately
const filters = reactive({
  company: '',
  type: '',
  tonnage: '',
  vesselId: ''
})

const options = reactive({
  companies: [],
  types: [],
  tonnages: []
})

// Computed property to get details of the selected vessel
const selectedVesselDetails = computed(() => {
  if (!filters.vesselId) return null
  return allVessels.value.find(v => v.id === filters.vesselId)
})

// Function to update filter options based on current selections
function updateOptions() {
  let filtered = allVessels.value
  
  if (filters.company) filtered = filtered.filter(v => v.company === filters.company)
  if (filters.type) filtered = filtered.filter(v => v.vessel_type === filters.type)
  if (filters.tonnage) filtered = filtered.filter(v => v.tonnage === Number(filters.tonnage))
  
  options.companies = [...new Set(filtered.map(v => v.company))].sort()
  options.types = [...new Set(filtered.map(v => v.vessel_type))].sort()
  options.tonnages = [...new Set(filtered.map(v => v.tonnage))].sort((a, b) => a - b)
  
  vessels.value = filtered.sort((a, b) => a.name.localeCompare(b.name))
}

// Handle vessel selection
function handleSelection() {
  emit('select', filters.vesselId)
  if (filters.vesselId) isExpanded.value = false
}

// Clear all selections
function clearSelection() {
  filters.company = ''
  filters.type = ''
  filters.tonnage = ''
  filters.vesselId = ''
  updateOptions()
  emit('select', '')
  isExpanded.value = true
}

// Watch for changes in filters to update options dynamically
watch(() => [filters.company, filters.type, filters.tonnage], updateOptions)

onMounted(async () => {
  try {
    const res = await fetch('/data/vessels.json')
    allVessels.value = await res.json()
    updateOptions()
  } catch (e) { console.error(e) }
})
</script>

<template>
  <div class="flex flex-col bg-white border-b border-gray-200 shadow-sm z-20 relative transition-all duration-300 rounded-t-2xl">
    
    <div class="flex items-center justify-between p-3 bg-slate-50/50 rounded-t-2xl">
      <div class="flex items-center gap-3 overflow-hidden">
        
        <div class="w-6 h-6 m-0.5 rounded-full flex items-center justify-center bg-white text-slate-400 font-bold text-xs border border-slate-200 shadow-sm shrink-0">
          {{ index }}
        </div>

        <img src="../assets/vessel-icon.svg" class="w-5 h-5 shrink-0" />

        <div v-if="selectedVesselDetails" class="flex flex-col overflow-hidden">
          <h3 class="text-sm font-bold text-[var(--main-deep-blue)] uppercase truncate leading-tight">
            {{ selectedVesselDetails.name }}
          </h3>
          
          <div class="flex items-center flex-wrap gap-x-2 text-[10px] text-slate-600 truncate mt-0.5">
            
            <div class="flex items-center gap-0.5">
              <span class="font-bold text-slate-400 text-[9px] uppercase">Company:</span>
              <span>{{ selectedVesselDetails.company || 'Unknown' }}</span>
            </div>

            <span class="text-slate-300">|</span>

            <div class="flex items-center gap-0.5">
              <span class="font-bold text-slate-400 text-[9px] uppercase">Type:</span>
              <span>{{ selectedVesselDetails.vessel_type || 'Unknown' }}</span>
            </div>

            <span class="text-slate-300">|</span>

            <div class="flex items-center gap-0.5">
              <span class="font-bold text-slate-400 text-[9px] uppercase">Tonnage:</span>
              <span>{{ selectedVesselDetails.tonnage ? selectedVesselDetails.tonnage + ' GT' : 'Unknown' }}</span>
            </div>

          </div>
        </div>
      </div>

      <button 
        @click="isExpanded = !isExpanded"
        class="text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all"
        :class="isExpanded ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-600 border-slate-200 shadow-sm hover:shadow'"
      >
        {{ isExpanded ? 'Close Filters' : 'Change Vessel' }}
      </button>
    </div>

    <div v-if="isExpanded" class="absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-xl rounded-b-lg p-3 grid grid-cols-2 lg:grid-cols-4 gap-2 z-[999]">

      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-slate-400 mb-0.5 ml-0.5">Company</label>
        <select v-model="filters.company" class="w-full h-[26px] text-[11px] bg-slate-50 border border-slate-200 rounded px-2 focus:ring-1 focus:ring-blue-400 focus:outline-none cursor-pointer">
          <option value="">Any</option>
          <option v-for="c in options.companies" :key="c">{{ c }}</option>
        </select>
      </div>

      <div class="flex flex-col">
        <label class="text-[9px] uppercase font-bold text-slate-400 mb-0.5 ml-0.5">Type</label>
        <select v-model="filters.type" class="w-full h-[26px] text-[11px] bg-slate-50 border border-slate-200 rounded px-2 focus:ring-1 focus:ring-blue-400 focus:outline-none cursor-pointer">
          <option value="">Any</option>
          <option v-for="t in options.types" :key="t">{{ t }}</option>
        </select>
      </div>

      <div class="flex flex-col col-span-2 lg:col-span-1">
        <label class="text-[9px] uppercase font-bold text-slate-400 mb-0.5 ml-0.5">Vessel Name</label>
        <select v-model="filters.vesselId" @change="handleSelection" class="w-full h-[26px] text-[11px] bg-slate-50 border border-slate-200 rounded px-2 focus:ring-1 focus:ring-blue-400 focus:outline-none cursor-pointer font-bold text-slate-700">
          <option value="">Select a Vessel...</option>
          <option v-for="v in vessels" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
      </div>

      <div class="flex items-end">
        <button @click="clearSelection" class="w-full h-[26px] mb-[1px] text-[10px] font-bold text-slate-400 uppercase bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-200 rounded transition-colors">
          Clear
        </button>
      </div>
    </div>
  </div>
</template>