<script setup>
import { onMounted, computed, ref, shallowRef } from 'vue'
import VesselFilters from '../components/VesselFilters.vue'
import TrajectoryPlot from '../components/d3/TrajectoryPlot.vue'

const selectedVesselId1 = ref('')
const selectedVesselId2 = ref('')
const isLoading = ref(true)

const rawData = shallowRef(null)

function handleSelectSlot1(id) { 
  selectedVesselId1.value = id 
}

function handleSelectSlot2(id) { 
  selectedVesselId2.value = id 
}

function getVesselData(vesselId) {
  if (!vesselId || !rawData.value) return null

  const d = rawData.value
  
  const vesselTraj = d.trajectories[vesselId] || []
  
  const vesselReports = d.harborReports.filter(r => r.source === vesselId)

  const vesselTrans = d.transactions
    .filter(t => t.suspected_vessels?.includes(vesselId))
    .map(t => ({
       ...t,
       commodityId: d.documentsMap[t.source]?.commodity || 'unknown'
    }))

  return {
    trajectory: vesselTraj,
    reports: vesselReports,
    transactions: vesselTrans
  }
}

const vesselData1 = computed(() => getVesselData(selectedVesselId1.value))
const vesselData2 = computed(() => getVesselData(selectedVesselId2.value))

onMounted(async () => {
  isLoading.value = true
  try {
    const [traj, reports, trans, docs, vessels] = await Promise.all([
      fetch('/data/trajectories.json').then(res => res.json()),
      fetch('/data/harbor_reports.json').then(res => res.json()),
      fetch('/data/transactions.json').then(res => res.json()),
      fetch('/data/documents.json').then(res => res.json()),
      fetch('/data/vessels.json').then(res => res.json()) // Utile per i filtri
    ])

    // Pre-processing Lookup Maps
    const docMap = Object.fromEntries(docs.map(d => [d.id, d]))

    rawData.value = {
      trajectories: traj,
      harborReports: reports,
      transactions: trans,
      documentsMap: docMap,
      vessels: vessels
    }
  } catch (e) {
    console.error("Error loading data:", e)
  } finally {
    isLoading.value = false
  }
})
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
          @select="handleSelectSlot1"
        />
        
        <div class="flex-grow relative bg-slate-50 overflow-hidden rounded-3xl">
          <div class="absolute inset-0">
             <TrajectoryPlot :vesselData="vesselData1" />
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
          @select="handleSelectSlot2" 
        />
        
        <div class="flex-grow relative bg-slate-50 overflow-hidden rounded-2xl">
          <div class="absolute inset-0">
             <TrajectoryPlot :vesselData="vesselData2" />
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