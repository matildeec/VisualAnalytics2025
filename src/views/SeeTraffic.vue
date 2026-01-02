<script setup>
import { ref, onMounted, computed } from 'vue'
import Map from '../components/d3/Map.vue'
import TrafficChart from '../components/d3/TrafficChart.vue'
import InfoCard from '../components/InfoCard.vue'

const selectedFeature = ref(null)
const allPings = ref([])

const minDwellHours = ref(2)
const hourStart = ref(0)
const hourEnd = ref(24)

const isIslandSelection = computed(() => {
    if (!selectedFeature.value) return false
    
    const kind = selectedFeature.value.properties['*Kind'] || selectedFeature.value.properties.type
    return kind === 'Island'
})

const filteredTrafficData = computed(() => {
    if (!selectedFeature.value || allPings.value.length === 0) return []

    const locationName = selectedFeature.value.properties.Name
    
    return allPings.value.filter(p => {
        // Location Filter
        if (p.source !== locationName) return false

        // Dwell Time Filter
        const dwellInHours = p.dwell / 3600
        if (dwellInHours < minDwellHours.value) return false

        // Hour Filter
        const hour = new Date(p.time).getHours()
        
        if (hourStart.value <= hourEnd.value) {
            if (hour < hourStart.value || hour >= hourEnd.value) return false
        } else {
            if (hour >= hourEnd.value && hour < hourStart.value) return false
        }

        return true
    })
})

onMounted(async () => {
    try {
        const res = await fetch('/data/transponder_pings.json')
        allPings.value = await res.json()
    } catch (e) {
        console.error("Errore nel caricamento pings:", e)
    }
})

const handleSelection = (feature) => {
    selectedFeature.value = feature
}
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden bg-gray-100">
        
        <div class="m-8 mt-4 pb-4 flex-col flex lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200">
            <h1 class="text-lg font-bold tracking-tight uppercase">Traffic Explorer</h1>
            <span class="flex text-xs text-gray-400 gap-2 flex-end">
                <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4 inline-block" />
                Explore global vessel movements and zone traffic through an interactive map interface.
            </span>
        </div>

        <div class="flex flex-grow overflow-hidden p-6 gap-3">
            
            <div class="w-2/7 h-full bg-white rounded-xl overflow-hidden relative border border-gray-100 shadow-sm flex flex-col">
                <div class="h-4/6 relative w-full">
                    <Map @feature-clicked="handleSelection" />
                </div>
                <div class="border-t border-slate-100"></div>
                <div class="h-2/6 p-4 overflow-y-auto bg-white">
                    <div v-if="selectedFeature" class="animate-in fade-in duration-300">
                        <InfoCard 
                            :vessel="selectedFeature.properties.Name"
                            :kind="selectedFeature.properties['*Kind'] || selectedFeature.properties.type"
                            :description="selectedFeature.properties.Description"
                            :activities="selectedFeature.properties.Activities"
                            :species="selectedFeature.properties.fish_species_present"
                        />
                    </div>
                    <div v-else class="h-full flex items-center justify-center text-gray-400 text-sm text-center">
                        <p>Click on a Fishing Zone or Harbor on the map to see details here.</p>
                    </div>
                </div>
            </div>

            <div class="w-5/7 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                <div class="flex-none bg-slate-50 border-b border-slate-200 p-3 flex items-center gap-4 lg:gap-8 h-16">
                    
                    <div class="flex flex-col min-w-[80px]">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vessels</span>
                        <div class="flex items-baseline gap-1">
                             <span class="text-xl font-black text-blue-600 leading-none">{{ filteredTrafficData.length }}</span>
                             <span class="text-[9px] text-slate-400">found</span>
                        </div>
                    </div>

                    <div class="w-px h-8 bg-slate-200"></div>

                    <div class="flex flex-col justify-center gap-1 w-48">
                        <div class="flex justify-between items-end">
                            <label class="text-[9px] font-bold text-slate-500 uppercase">Min Dwell Time</label>
                            <span class="text-[10px] font-mono font-bold text-blue-600">{{ minDwellHours }}h</span>
                        </div>
                        <input 
                            type="range" 
                            v-model.number="minDwellHours" 
                            min="0" max="100" 
                            class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div class="w-px h-8 bg-slate-200"></div>

                    <div class="flex flex-col justify-center gap-1">
                        <label class="text-[9px] font-bold text-slate-500 uppercase">Hour Filter (24h)</label>
                        <div class="flex items-center gap-2 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                            <input 
                                type="number" 
                                v-model.number="hourStart" 
                                min="0" max="23" 
                                class="w-8 text-xs font-mono text-center outline-none bg-transparent"
                            />
                            <span class="text-xs text-slate-300 font-bold">:00</span>
                            <span class="text-[10px] text-slate-400">to</span>
                            <input 
                                type="number" 
                                v-model.number="hourEnd" 
                                min="0" max="24" 
                                class="w-8 text-xs font-mono text-center outline-none bg-transparent"
                            />
                            <span class="text-xs text-slate-300 font-bold">:00</span>
                        </div>
                    </div>

                    <div class="ml-auto text-[9px] text-slate-400 italic hidden xl:block max-w-[200px] text-right">
                        Use filters to isolate suspicious patterns like night activity (e.g. 22 to 05) or long stops.
                    </div>
                </div>

                <div class="flex-1 min-h-0 w-full relative">
                    
                    <div v-if="!selectedFeature" class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white text-center p-8">
                        <p class="text-gray-400">
                            Please select a Fishing Zone or Harbor on the map to visualize traffic patterns and anomalies.
                        </p>
                    </div>

                    <div v-else class="flex flex-col h-full w-full">
                        <div v-if="isIslandSelection" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white text-center p-8">
                            <h3 class="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">No Traffic Data Available</h3>
                            <p class="text-gray-400">
                                Please select a valid fishing zone or harbor to view vessel activity.
                            </p>
                        </div>

                        <TrafficChart :data="filteredTrafficData" />
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 10px;
  width: 10px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  margin-top: -4px; 
}
</style>