<template>
  <div class="mb-4 flex flex-wrap gap-3 items-end bg-white rounded-lg p-4 shadow-sm border border-gray-200">
    <div class="flex flex-col">
      <label class="text-xs text-gray-500 mb-1">Company</label>
      <select v-model="selectedCompany" @change="onCompanyChange" class="min-w-[140px] px-3 py-2 rounded-md border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm">
        <option value="">All</option>
        <option v-for="c in companies" :key="c">{{ c }}</option>
      </select>
    </div>
    <div class="flex flex-col">
      <label class="text-xs text-gray-500 mb-1">Vessel Type</label>
      <select v-model="selectedType" @change="onTypeChange" class="min-w-[120px] px-3 py-2 rounded-md border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm">
        <option value="">All</option>
        <option v-for="t in vesselTypes" :key="t">{{ t }}</option>
      </select>
    </div>
    <div class="flex flex-col">
      <label class="text-xs text-gray-500 mb-1">Tonnage</label>
      <select v-model="selectedTonnage" @change="onTonnageChange" class="min-w-[100px] px-3 py-2 rounded-md border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm">
        <option value="">All</option>
        <option v-for="t in tonnages" :key="t">{{ t }}</option>
      </select>
    </div>
    <div class="flex flex-col">
      <label class="text-xs text-gray-500 mb-1">Vessel</label>
      <select v-model="selectedVessel" @change="$emit('select', selectedVessel)" class="min-w-[160px] px-3 py-2 rounded-md border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm">
        <option value="">All</option>
        <option v-for="v in vessels" :key="v.id" :value="v.id">{{ v.name }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['select']) // defines the emit function to emit events to parent component

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
  if (selectedCompany.value) filtered = filtered.filter(v => v.company === selectedCompany.value)
  if (selectedType.value) filtered = filtered.filter(v => v.vessel_type === selectedType.value)
  if (selectedTonnage.value) filtered = filtered.filter(v => v.tonnage === Number(selectedTonnage.value))
  companies.value = [...new Set(filtered.map(v => v.company))]
  vesselTypes.value = [...new Set(filtered.map(v => v.vessel_type))]
  tonnages.value = [...new Set(filtered.map(v => v.tonnage))]
  vessels.value = filtered
}

function onCompanyChange() {
  selectedType.value = ''
  selectedTonnage.value = ''
  selectedVessel.value = ''
  filterOptions()
}
function onTypeChange() {
  selectedTonnage.value = ''
  selectedVessel.value = ''
  filterOptions()
}
function onTonnageChange() {
  selectedVessel.value = ''
  filterOptions()
}

onMounted(async () => {
  console.log('VesselFilters mounted')
  const vesselsRes = await fetch('data/vessels.json')
  allVessels.value = await vesselsRes.json()
  console.log('Loaded vessels:', allVessels.value.length)
  filterOptions()
})
</script>