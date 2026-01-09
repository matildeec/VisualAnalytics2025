<script setup>
import { ref, reactive, onMounted, computed, shallowRef } from 'vue'
import HarborActivityChart from '../components/d3/HarborActivityChart.vue'
import { getVesselColor, getCommodityStatus, getFishIcon, commodityStyles, illegalCommodities } from '../components/d3/utils.js'
import { getCommodities, getTransactions, getDocuments, getVessels, getHarborReports, getAssetPath } from '../dataManager.js';

const cargoData = ref([]);
const vesselData = ref([]);
const availableHarbors = ref([]);

const viewData = reactive({
  cargo: [],
  vessels: []
})

const rawData = shallowRef({})

const selectedHarbor = ref('');
const hiddenCommodities = reactive(new Set());
const hiddenVesselTypes = reactive(new Set());

const sidebarRef = ref(null);
const topBoxHeight = ref(50);
const isResizing = ref(false);
const expandedCargoId = ref(null);

// --- Handlers ---
const handleViewUpdate = (payload) => {
  viewData.cargo = payload.cargo || []
  viewData.vessels = payload.vessels || []
}

const toggleCommodity = (id) => {
  if (hiddenCommodities.has(id)) hiddenCommodities.delete(id)
  else hiddenCommodities.add(id)
}
const toggleVesselType = (type) => {
  if (hiddenVesselTypes.has(type)) hiddenVesselTypes.delete(type)
  else hiddenVesselTypes.add(type)
}

// Sidebar Resize Logic
const startResizing = () => { isResizing.value = true; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', stopResizing); };
const handleMouseMove = (e) => {
  if (!isResizing.value || !sidebarRef.value) return;
  const sidebarRect = sidebarRef.value.getBoundingClientRect();
  const offsetTop = e.clientY - sidebarRect.top;
  let newPercent = (offsetTop / sidebarRect.height) * 100;
  if (newPercent < 15) newPercent = 15; if (newPercent > 85) newPercent = 85;
  topBoxHeight.value = newPercent;
};
const stopResizing = () => { isResizing.value = false; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', stopResizing); };

const toggleCargoExpansion = (cargoId) => {
  expandedCargoId.value = expandedCargoId.value === cargoId ? null : cargoId;
}

const getCommodityButtonClasses = (id) => {
    if (hiddenCommodities.has(id)) {
        return 'bg-slate-100 border-transparent text-slate-400 opacity-60 hover:opacity-100 grayscale';
    }

    const status = getCommodityStatus(id);
    const baseClasses = commodityStyles[status];
    
    return `${baseClasses} shadow-sm hover:shadow-md`;
}

const filteredCargoData = computed(() => {
    if (!selectedHarbor.value) return [];
    return cargoData.value.filter(d => d.target === selectedHarbor.value);
});

const filteredVesselData = computed(() => {
    if (!selectedHarbor.value) return [];
    return vesselData.value.filter(v => v.target === selectedHarbor.value);
});

onMounted(async () => {
    try {
        const [trans, docs, comms, reports, vessels] = await Promise.all([
          getTransactions(),
          getDocuments(),
          getCommodities(),
          getHarborReports(),
          getVessels()
        ]);

        const docMap = Object.fromEntries(docs.map(d => [d.id, d]));

        const commodityNames = Object.fromEntries(comms.map(c => [c.id, c.name]));
        const vesselLookup = Object.fromEntries(vessels.map(v => [v.id, v]));
        
        cargoData.value = trans.map((t, index) => {
          const cargoDetail = docMap[t.source];
          return { 
             ...t, 
             id: t.id || `trans-${index}`,
             date: new Date(t.date), 
             commodity: cargoDetail ? cargoDetail.commodity : 'unknown', 
             qty: cargoDetail ? parseFloat(cargoDetail.qty_tons) : 0 
          };
        }).filter(d => d.qty > 0);

        vesselData.value = reports.map(r => {
          const vesselDetail = vesselLookup[r.source];
          return { 
             ...r, 
             date: new Date(r.date), 
             name: vesselDetail?.name || 'Unknown', 
             vessel_type: vesselDetail?.vessel_type || 'Unknown', 
             tonnage: parseFloat(vesselDetail?.tonnage) || 0, 
             company: vesselDetail?.company || 'Unknown' 
          };
        }).filter(v => v.tonnage > 0);

        availableHarbors.value = [...new Set(cargoData.value.map(d => d.target))].sort();        
        const vesselTypes = [...new Set(vesselData.value.map(v => v.vessel_type))].sort();
        
        const uniqueCommodities = new Set(cargoData.value.map(d => d.commodity));
        const commodities = Array.from(uniqueCommodities).sort();

        const vesselColorMap = {};
        vesselTypes.forEach(type => {
            vesselColorMap[type] = getVesselColor(type);
        });

        rawData.value = {
            commodityNames: commodityNames,
            vesselLookup: vesselLookup,
            vesselTypes: vesselTypes,
            commodities: commodities,
            vesselColorMap: vesselColorMap,
            ready: true
        };

    } catch (e) {
        console.error("Error loading data:", e);
    }
});
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-50">
    
    <div class="mx-8 mt-4 shrink-0 flex flex-col gap-4">
      <div class="flex justify-between lg:flex-row items-start lg:items-center gap-2">
        <div class="flex flex-row gap-2">
          <h1 class="text-lg font-bold tracking-tight uppercase">Harbor Inspector</h1>
          <div class="flex items-center text-xs text-gray-400 gap-2">
            <img :src="getAssetPath('icon-info.svg')" alt="info" class="w-4 h-4" />
            <span>Select a harbor to view activity. Shift+Drag to analyze a specific time window.</span>
          </div>
        </div>

        <div class="flex flex-row gap-3 items-center">
          <span class="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Harbor</span>
          <div class="flex items-center bg-gray-100/80 p-1 rounded-full border border-gray-200">
            <button 
              v-for="h in availableHarbors" 
              :key="h"
              @click="selectedHarbor = h"
              class="px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all duration-200 whitespace-nowrap select-none cursor-pointer"
              :class="selectedHarbor === h 
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'"
            >
              {{ h }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-8 mt-4 mb-3 shrink-0">
      <div v-if="rawData.ready" class="bg-white rounded-2xl shadow-sm px-3 py-2 flex flex-col gap-2">
        
        <div class="flex items-start gap-3">
          <div class="mt-1.5 flex items-center gap-1.5 min-w-[70px] text-gray-600">
            <span class="text-[10px] font-bold uppercase tracking-wider">Cargo</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button 
              v-for="id in rawData.commodities" 
              :key="id" 
              @click="toggleCommodity(id)"
              :disabled="!selectedHarbor"
              class="group flex items-center gap-2 pl-1 pr-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-200 select-none border"
              :class="[
                !selectedHarbor
                  ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 cursor-not-allowed' 
                  : hiddenCommodities.has(id) 
                    ? 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 grayscale opacity-70' 
                    : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:border-blue-300 ring-1 ring-transparent hover:ring-blue-100'
              ]"
            >
              <div 
                class="w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0"
                :class="[
                   !selectedHarbor ? 'border-slate-100 grayscale' : getCommodityButtonClasses(id)
                ]"
              >
                <img 
                  :src="getAssetPath(getFishIcon(id))" 
                  alt="fish"
                  class="w-3 h-3 object-contain"
                  :class="{ 'opacity-50': !selectedHarbor }"
                />
              </div>
              
              <span>{{ rawData.commodityNames[id] || id }}</span>
              
            </button>
          </div>
        </div>

        <div class="h-px w-full bg-gray-100"></div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 min-w-[70px] text-gray-600">
            <span class="text-[10px] font-bold uppercase tracking-wider">Vessels</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button 
              v-for="type in rawData.vesselTypes" 
              :key="type" 
              @click="toggleVesselType(type)"
              :disabled="!selectedHarbor"
              class="flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase transition-all duration-200 select-none"
              :class="[
                !selectedHarbor
                  ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 cursor-not-allowed' 
                  : hiddenVesselTypes.has(type) 
                    ? 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100' 
                    : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:border-blue-300' 
              ]"
            >
              <span 
                class="w-2 h-2 rounded-full shadow-sm ring-1 ring-black/5" 
                :style="{ backgroundColor: (!selectedHarbor || hiddenVesselTypes.has(type)) ? '#cbd5e1' : rawData.vesselColorMap[type] }"
              ></span>
              <span>{{ type }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  
    <div class="flex-grow px-8 pb-6 flex gap-2 overflow-hidden min-h-0">
      
      <div class="flex-1 min-w-0 h-full relative rounded-xl shadow-sm bg-white overflow-hidden">
        <div v-if="!selectedHarbor" class="absolute inset-0 z-999 flex flex-col items-center justify-center bg-white">
            <p class="text-gray-400">Select a harbor from the list above</p>
        </div>
        <HarborActivityChart 
            :cargo-data="filteredCargoData"
            :vessel-data="filteredVesselData"
            :commodity-names="rawData.commodityNames"
            :vessel-color-map="rawData.vesselColorMap"
            :vessel-lookup="rawData.vesselLookup"
            :hidden-commodities="hiddenCommodities"
            :hidden-vessel-types="hiddenVesselTypes"
            @view-updated="handleViewUpdate"
        />
      </div>

      <div ref="sidebarRef" class="w-[280px] shrink-0 flex flex-col h-full relative select-none overflow-hidden transition-none">
        
        <div v-if="isResizing" class="fixed inset-0 z-[9999] cursor-row-resize" @mousemove="handleMouseMove" @mouseup="stopResizing"></div>

        <div class="flex flex-col bg-white rounded-t-xl border border-gray-200 shadow-sm overflow-hidden min-h-0" :style="{ height: topBoxHeight + '%', maxHeight: topBoxHeight + '%' }">
          <div class="p-3 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 class="text-[10px] font-bold uppercase text-slate-600">Cargo in Range</h3>
            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{{ viewData.cargo.length }}</span>
          </div>
          
          <div class="flex-grow overflow-y-auto p-2 flex flex-col gap-2 no-scrollbar bg-slate-50/10 min-h-0">
            <div v-if="viewData.cargo.length === 0" class="h-full flex items-center justify-center text-center p-4">
               <p class="text-[9px] text-slate-400 uppercase font-bold" v-if="selectedHarbor">No cargo in range</p>
            </div>
            <div v-for="(cargo, idx) in viewData.cargo" :key="'c-'+idx" 
                  class="flex flex-col rounded-lg border border-slate-100 bg-white shadow-sm shrink-0 transition-all overflow-hidden"
                  :class="{ 'border-red-300 ring-1 ring-red-100': illegalCommodities.has(cargo.commodity), 'border-blue-300 shadow-md': expandedCargoId === cargo.id }">
                <div @click="toggleCargoExpansion(cargo.id)" class="p-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div class="flex justify-between items-start mb-1">
                    <div class="flex items-center gap-2 overflow-hidden">
                      <span class="text-[8px] transition-transform duration-200 shrink-0" :class="{ 'rotate-180': expandedCargoId === cargo.id }">▼</span>
                      <span class="text-[10px] font-bold text-slate-800 truncate" :class="{ 'text-red-700': illegalCommodities.has(cargo.commodity) }">
                        {{ rawData.commodityNames[cargo.commodity] || cargo.commodity }}
                      </span>
                      <div 
                        class="w-4 h-4 m-0.5 rounded-full flex items-center justify-center border transition-colors shrink-0"
                        :class="getCommodityButtonClasses(cargo.commodity)"
                      >
                        <img 
                          :src="getAssetPath(getFishIcon(cargo.commodity))" 
                          alt="fish"
                          class="w-3 h-3 object-contain"
                        />
                      </div>
                    </div>
                    <span class="text-[8px] font-mono text-slate-400 shrink-0">{{ cargo.date.toLocaleDateString() }}</span>
                  </div>
                  <div class="flex justify-between items-center ml-4">
                    <span class="text-[9px] font-bold text-slate-500 italic">{{ cargo.qty.toFixed(1) }} Tons</span>
                    <div class="flex gap-2 items-center">
                      <span v-if="cargo.suspected_vessels?.length" class="text-[7px] font-bold text-blue-500 uppercase">{{ cargo.suspected_vessels.length }} Suspects</span>
                      <span v-if="illegalCommodities.has(cargo.commodity)" class="text-[8px] font-bold text-red-600 uppercase">⚠️ Illegal</span>
                    </div>
                  </div>
                </div>
                <div v-if="expandedCargoId === cargo.id" class="bg-slate-50 border-t border-slate-100 p-2 flex flex-col gap-1.5">
                  <h4 class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Suspected Vessels:</h4>
                  <div v-if="!cargo.suspected_vessels || cargo.suspected_vessels.length === 0" class="text-[9px] italic text-slate-400">No suspected vessels recorded.</div>
                  <div v-for="vId in cargo.suspected_vessels" :key="vId" class="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200">
                    <div class="flex flex-col overflow-hidden">
                      <span class="text-[9px] font-bold text-slate-700 truncate">{{ rawData.vesselLookup[vId]?.name || vId }}</span>
                      <span class="text-[8px] text-slate-500 truncate">{{ rawData.vesselLookup[vId]?.company || 'Unknown Company' }}</span>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div @mousedown.prevent="startResizing" @dblclick="topBoxHeight = 50" class="h-1.5 w-full hover:bg-blue-400 cursor-row-resize flex items-center justify-center transition-colors group bg-gray-50 border-x border-gray-200" :class="{ 'bg-blue-600': isResizing }">
          <div class="w-10 h-1 bg-gray-300 rounded-full group-hover:bg-white transition-colors"></div>
        </div>

        <div class="flex flex-col bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden min-h-0" :style="{ height: (100 - topBoxHeight) + '%', maxHeight: (100 - topBoxHeight) + '%' }">
          <div class="p-3 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 class="text-[10px] font-bold uppercase text-slate-600">Vessels in Range</h3>
            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{{ viewData.vessels.length }}</span>
          </div>
          
          <div class="flex-grow overflow-y-auto p-2 flex flex-col gap-2 no-scrollbar bg-slate-50/10 min-h-0">
            <div v-if="viewData.vessels.length === 0" class="h-full flex items-center justify-center text-center p-4">
               <p class="text-[9px] text-slate-400 uppercase font-bold" v-if="selectedHarbor">No vessels in range</p>
            </div>
            <div v-for="(vessel, idx) in viewData.vessels" :key="'v-'+idx" class="p-2.5 rounded-lg border border-slate-100 bg-white shadow-sm shrink-0 overflow-hidden">
              <div class="flex justify-between items-start mb-1">
                <div class="flex flex-wrap items-center gap-1 overflow-hidden">
                  <span class="text-[10px] font-bold text-slate-800 truncate max-w-[120px]">{{ vessel.name }}</span>
                  <div class="flex items-center gap-1 shrink-0">
                    <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: rawData.vesselColorMap[vessel.vessel_type] }"></div>
                    <span class="text-[8px] font-bold text-slate-500 uppercase">{{ vessel.vessel_type }}</span>
                  </div>
                </div>
                <span class="text-[8px] font-mono text-slate-400 shrink-0">{{ vessel.date.toLocaleDateString() }}</span>
              </div>
              <div class="flex items-center gap-1.5 overflow-hidden">
                <span class="text-[9px] text-slate-500 truncate">{{ vessel.company }}</span>
                <span class="text-[9px] text-slate-500 shrink-0">| Tonnage: {{ vessel.tonnage.toFixed(1) }}</span>
              </div>
            </div>
          </div>
        </div>

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
  -webkit-appearance: none; -moz-appearance: none; appearance: none;
}
.no-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.no-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.no-scrollbar::-webkit-scrollbar-track { background: transparent; }
.select-none { user-select: none; }
.cursor-row-resize { cursor: row-resize !important; }
</style>