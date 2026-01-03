<script setup>
import { ref, onMounted, computed } from 'vue'
import Map from '../components/d3/Map.vue'
import TrafficChart from '../components/d3/TrafficChart.vue'
import InfoCard from '../components/InfoCard.vue'

const selectedFeature = ref(null)
const allPings = ref([])

const hourStart = ref(0)
const hourEnd = ref(24)
const tempHourStart = ref(0)
const tempHourEnd = ref(24)

const setPreset = (start, end) => {
    tempHourStart.value = start
    tempHourEnd.value = end
}

const validateRange = () => {
    if (tempHourStart.value > tempHourEnd.value - 1) {
        tempHourStart.value = tempHourEnd.value - 1
    }
}

const selectionStyle = computed(() => {
    const startPercent = (tempHourStart.value / 24) * 100
    const endPercent = (tempHourEnd.value / 24) * 100
    return {
        left: `${startPercent}%`,
        width: `${endPercent - startPercent}%`
    }
})

const applyFilters = () => {
    hourStart.value = tempHourStart.value
    hourEnd.value = tempHourEnd.value
}

const isIslandSelection = computed(() => {
    if (!selectedFeature.value) return false
    
    const kind = selectedFeature.value.properties['*Kind'] || selectedFeature.value.properties.type
    const centralia_city = selectedFeature.value.properties.Name === 'Centralia'
    return kind === 'Island' || centralia_city
})

const filteredTrafficData = computed(() => {
    if (!selectedFeature.value || allPings.value.length === 0) return []

    const locationName = selectedFeature.value.properties.Name
    
    return allPings.value.filter(p => {
        // Location Filter
        if (p.source !== locationName) return false

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

const uniqueVesselCount = computed(() => {
    const pings = filteredTrafficData.value
    if (!pings || pings.length === 0) return 0
    
    const uniqueIds = new Set(pings.map(p => p.target))
    return uniqueIds.size
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

                <div class="flex-none bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between h-auto gap-8">
                    
                    <div class="flex flex-col min-w-[100px] border-r border-gray-100 pr-6">
                        <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Active Vessels</span>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-2xl font-bold text-gray-500 leading-none">{{ uniqueVesselCount }}</span>
                            <span class="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">filtered</span>
                        </div>
                    </div>

                    <div class="flex flex-col flex-1 max-w-2xl">
                        
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2 text-xs font-mono text-gray-600">
                                <span class="font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                    {{ String(tempHourStart).padStart(2, '0') }}:00
                                </span>
                                <span class="text-gray-300">–</span>
                                <span class="font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                    {{ String(tempHourEnd).padStart(2, '0') }}:00
                                </span>
                            </div>

                            <div class="flex gap-1">
                                <button @click="setPreset(0, 24)" class="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded hover:bg-gray-100 text-gray-500 transition-colors">All</button>
                                <button @click="setPreset(6, 18)" class="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded hover:bg-blue-50 text-blue-600 transition-colors">Day</button>
                                <button @click="setPreset(18, 24)" class="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded hover:bg-slate-100 text-slate-600 transition-colors">Night</button>
                            </div>
                        </div>

                        <div class="relative w-full h-8 group select-none">
                            
                            <div class="absolute inset-x-0 bottom-0 h-4 border-b border-gray-300 flex justify-between items-end px-[1px]">
                                <div v-for="i in 25" :key="i" class="w-px bg-gray-300" 
                                    :class="(i-1) % 6 === 0 ? 'h-3' : 'h-1.5'"></div>
                            </div>
                            <div class="absolute inset-x-0 bottom-[-14px] flex justify-between px-0 text-[9px] text-gray-400 font-mono">
                                <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                            </div>

                            <div class="absolute top-2 bottom-2 left-0 right-0 bg-gray-100 rounded-sm"></div>

                            <div 
                                class="absolute top-2 bottom-2 bg-slate-500/90 z-10 shadow-sm"
                                :style="selectionStyle"
                            ></div>

                            <input 
                                type="range" v-model.number="tempHourStart" @input="validateRange"
                                min="0" max="24" step="1"
                                class="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-30 slider-thumb-tech"
                            />
                            <input 
                                type="range" v-model.number="tempHourEnd" @input="validateRange"
                                min="0" max="24" step="1"
                                class="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-30 slider-thumb-tech"
                            />
                        </div>
                    </div>

                    <div class="flex items-center border-l border-gray-100 pl-6 h-full">
                        <button 
                            @click="applyFilters"
                            class="h-9 px-6 bg-slate-500/90 hover:bg-slate-600/90 text-white text-[11px] font-bold uppercase tracking-wider rounded-3xl shadow-md flex items-center gap-2"
                        >
                            Update Map
                        </button>
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
.slider-thumb-tech {
  -webkit-appearance: none;
  pointer-events: none;
}

.slider-thumb-tech::-webkit-slider-thumb {
  -webkit-appearance: none;
  pointer-events: auto; 
  height: 20px;
  width: 12px;
  border-radius: 2px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: ew-resize;
  margin-top: -6px;
  position: relative;
  z-index: 40;
  
  background-image: linear-gradient(to right, transparent 3px, #e5e7eb 3px, #e5e7eb 4px, transparent 4px, transparent 7px, #e5e7eb 7px, #e5e7eb 8px, transparent 8px);
}

.slider-thumb-tech::-webkit-slider-thumb:hover {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.slider-thumb-tech::-moz-range-thumb {
  pointer-events: auto;
  height: 20px;
  width: 12px;
  border-radius: 2px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  cursor: ew-resize;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  z-index: 40;
}
</style>