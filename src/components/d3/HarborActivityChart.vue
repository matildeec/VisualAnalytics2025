<script setup>
import * as d3 from 'd3';
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue';
import { illegalCommodities } from './utils.js';
import Tooltip from '../Tooltip.vue';

const props = defineProps({ selectedHarbor: String });
const emit = defineEmits(['harbors-loaded']);

// --- Data & Refs ---
const chartContainer = ref(null);
const hiddenCommodities = ref(new Set());
const hiddenVesselTypes = ref(new Set());
const rawCargo = ref([]);
const rawVessels = ref([]);
const commodityNames = ref({});
const vesselColorMap = ref({});
const currentTransform = ref(d3.zoomIdentity);

const brushRange = ref(null);

const sidebarRef = ref(null);
const topBoxHeight = ref(50);
const isResizing = ref(false);

const startResizing = () => {
  isResizing.value = true;
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', stopResizing);
};

const handleMouseMove = (e) => {
  if (!isResizing.value || !sidebarRef.value) return;

  const sidebarRect = sidebarRef.value.getBoundingClientRect();
  const offsetTop = e.clientY - sidebarRect.top;
  let newPercent = (offsetTop / sidebarRect.height) * 100;
  
  if (newPercent < 15) newPercent = 15;
  if (newPercent > 85) newPercent = 85;
  
  topBoxHeight.value = newPercent;
};

const stopResizing = () => {
  isResizing.value = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', stopResizing);
};

// --- Computed: Vessels & Cargo in View ---
const vesselsInView = computed(() => {
  if (!props.selectedHarbor || !rawVessels.value.length || !brushRange.value) return [];
  
  const [minDate, maxDate] = brushRange.value;

  return rawVessels.value
    .filter(v => {
      const isInHarbor = v.target === props.selectedHarbor;
      const isNotFiltered = !hiddenVesselTypes.value.has(v.vessel_type);
      const isInBrush = v.date >= minDate && v.date <= maxDate; // Filtro sul brush
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); // Sort by date descending
});

const cargoInView = computed(() => {
  if (!props.selectedHarbor || !rawCargo.value.length || !brushRange.value) return [];
  
  const [minDate, maxDate] = brushRange.value;

  return rawCargo.value
    .filter(d => {
      const isInHarbor = d.target === props.selectedHarbor;
      const isNotFiltered = !hiddenCommodities.value.has(d.commodity);
      const isInBrush = d.date >= minDate && d.date <= maxDate;
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); // Sort by date descending
});

// --- Configuration for Responsive Fitting ---
const margin = { top: 20, right: 30, bottom: 20, left: 80 };
const chartHeight = 220; 
const gap = 30; // Central space for the X-axis
const logicalWidth = 1000; 
const logicalHeight = (chartHeight * 2) + margin.top + margin.bottom + gap;

let x; // Shared X scale

const vesselLookup = ref({});

const tooltip = reactive({ x: 0, y: 0, contentDict: null, visible: false, variant: 'default' });

// --- Tooltip Logic ---
function showTooltip(event, d, type = 'cargo') {
  tooltip.x = event.clientX + 15;
  tooltip.y = event.clientY + 15;
  
  if (type === 'cargo') {
    const isIllegal = illegalCommodities.has(d.commodity);
    tooltip.contentDict = {
      'Commodity': commodityNames.value[d.commodity] || d.commodity,
      'Weight': `${d.qty.toFixed(2)} tons`,
      'Date': d.date.toLocaleDateString(),
      'Status': isIllegal ? '⚠️ ILLEGAL' : 'Verified'
    };
    tooltip.variant = isIllegal ? 'danger' : 'default';
  } else {
    tooltip.contentDict = {
      'Vessel': d.name,
      'Type': d.vessel_type,
      'Tonnage': `${d.tonnage.toFixed(2)} tons`,
      'Date': d.date.toLocaleDateString()
    };
    tooltip.variant = 'default';
  }
  tooltip.visible = true;
}

function hideTooltip() { tooltip.visible = false; }

// --- Data Loading & Specular Joining ---
async function loadData() {
  try {
    const [trans, docs, comms, reports, vessels] = await Promise.all([
      fetch('/data/transactions.json').then(res => res.json()),
      fetch('/data/documents.json').then(res => res.json()),
      fetch('/data/commodities.json').then(res => res.json()),
      fetch('/data/harbor_reports.json').then(res => res.json()),
      fetch('/data/vessels.json').then(res => res.json())
    ]);

    const docMap = Object.fromEntries(docs.map(d => [d.id, d]));
    commodityNames.value = Object.fromEntries(comms.map(c => [c.id, c.name]));

    // Join Cargo
    rawCargo.value = trans.map(t => {
      const cargoDetail = docMap[t.source];
      return {
        ...t, date: new Date(t.date),
        commodity: cargoDetail ? cargoDetail.commodity : 'unknown',
        qty: cargoDetail ? parseFloat(cargoDetail.qty_tons) : 0
      };
    }).filter(d => d.qty > 0);

    // Join Vessels (Harbor Reports + Vessel Details)
    vesselLookup.value = Object.fromEntries(vessels.map(v => [v.id, v]));

    rawVessels.value = reports.map(r => {
      const vesselDetail = vesselLookup.value[r.source];
      return {
        ...r, date: new Date(r.date),
        name: vesselDetail?.name || 'Unknown',
        vessel_type: vesselDetail?.vessel_type || 'Unknown Type',
        tonnage: parseFloat(vesselDetail?.tonnage) || 0,
        company: vesselDetail?.company || 'Unknown Company'
      };
    }).filter(v => v.tonnage > 0);

    // Stable Vessel Color Mapping
    const types = [...new Set(rawVessels.value.map(v => v.vessel_type))].sort();
    const vScale = d3.scaleOrdinal(d3.schemeSet2).domain(types);
    vesselColorMap.value = Object.fromEntries(types.map(t => [t, vScale(t)]));

    emit('harbors-loaded', Array.from(new Set(rawCargo.value.map(d => d.target))).sort());
    renderChart();
  } catch (err) { console.error("Data fetch error:", err); }
}

const expandedCargoId = ref(null);

function toggleCargoExpansion(cargoId) {
  // Se clicco su quello già aperto, lo chiudo (null), altrimenti apro il nuovo
  expandedCargoId.value = expandedCargoId.value === cargoId ? null : cargoId;
}

// --- Mirror Stacking Logic ---
const filteredCargo = computed(() => {
  if (!props.selectedHarbor) return [];
  const active = rawCargo.value.filter(d => d.target === props.selectedHarbor && !hiddenCommodities.value.has(d.commodity));
  const stacks = []; const dayTracker = {};
  active.sort((a,b) => a.date - b.date).forEach(d => {
    const day = d.date.toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    stacks.push({ ...d, y0: base, y1: base + d.qty });
    dayTracker[day] = base + d.qty;
  });
  return stacks;
});

const filteredVessels = computed(() => {
  if (!props.selectedHarbor) return [];
  const active = rawVessels.value.filter(v => v.target === props.selectedHarbor && !hiddenVesselTypes.value.has(v.vessel_type));
  const stacks = []; const dayTracker = {};
  active.sort((a,b) => a.vessel_type.localeCompare(b.vessel_type) || a.date - b.date).forEach(v => {
    const day = v.date.toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    stacks.push({ ...v, y0: base, y1: base + v.tonnage });
    dayTracker[day] = base + v.tonnage;
  });
  return stacks;
});

// --- D3 Chart Rendering ---
async function renderChart() {
  await nextTick();
  if (!chartContainer.value) return;
  const container = d3.select(chartContainer.value);
  container.selectAll('*').remove();
  if (!props.selectedHarbor) return;

  // --- SETUP SVG ---
  const gap = 35; // Central space for the X-axis
  const cargoBaseY = margin.top + chartHeight; 
  const vesselBaseY = cargoBaseY + gap;       
  
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${logicalWidth + margin.left + margin.right} ${logicalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%')
    .style('display', 'block');

  // --- CLIP PATH ---
  const defs = svg.append('defs');
  defs.append('clipPath')
    .attr('id', 'chart-content-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', -chartHeight)
    .attr('width', logicalWidth)
    .attr('height', chartHeight * 2 + gap);

  // --- SCALE ---
  const allDates = [...filteredCargo.value.map(d => d.date), ...filteredVessels.value.map(d => d.date)];
  x = d3.scaleTime().domain(d3.extent(allDates)).range([0, logicalWidth]);

  // --- INTERAZIONI ---
  const brush = d3.brushX()
    .extent([[0, 0], [logicalWidth, (chartHeight * 2) + gap]])
    .filter(event => event.shiftKey)
    .on('brush end', (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection;
        const activeX = currentTransform.value.rescaleX(x);
        brushRange.value = [activeX.invert(x0), activeX.invert(x1)];
      } else {
        brushRange.value = null;
      }
    });

  const zoom = d3.zoom()
    .scaleExtent([1, 100])
    .filter(event => !event.shiftKey)
    .on('zoom', (event) => {
      currentTransform.value = event.transform;
      const newX = event.transform.rescaleX(x);
      svg.selectAll('.x-axis').call(d3.axisBottom(newX));
      svg.selectAll('.bar-element').attr('x', d => newX(d.date) - 3);
      svg.select(".brush").call(brush.move, null);
      brushRange.value = null;
    });

  svg.append('g')
    .attr('class', 'brush')
    .attr('transform', `translate(${margin.left},${margin.top})`)
    .call(brush);
  

  // Cargo
  const gCargo = svg.append('g')
    .attr('transform', `translate(${margin.left},${cargoBaseY})`)
    .attr('clip-path', 'url(#chart-content-clip)');

  const yCargo = d3.scaleLinear()
    .domain([0, d3.max(filteredCargo.value, d => d.y1) * 1.1 || 100])
    .range([0, -chartHeight]);

  gCargo.selectAll('.bar-cargo').data(filteredCargo.value).enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yCargo(d.y1))
    .attr('width', 6)
    .attr('height', d => Math.abs(yCargo(d.y1) - yCargo(d.y0)))
    .attr('fill', d => illegalCommodities.has(d.commodity) ? '#ef4444' : '#3b82f6')
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'cargo'))
    .on('mouseleave', hideTooltip);

  // Vessels
  const gVessel = svg.append('g')
    .attr('transform', `translate(${margin.left},${vesselBaseY})`)
    .attr('clip-path', 'url(#chart-content-clip)'); // Applica lo STESSO clip qui

  const yVessel = d3.scaleLinear()
    .domain([0, d3.max(filteredVessels.value, d => d.y1) * 1.1 || 100])
    .range([0, chartHeight]);

  gVessel.selectAll('.bar-vessel').data(filteredVessels.value).enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yVessel(d.y0))
    .attr('width', 6)
    .attr('height', d => Math.abs(yVessel(d.y1) - yVessel(d.y0)))
    .attr('fill', d => vesselColorMap.value[d.vessel_type] || '#ccc')
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'vessel')).on('mouseleave', hideTooltip);

  // Axes
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(${margin.left},${cargoBaseY})`)
    .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0));

  svg.append('g')
    .attr('transform', `translate(${margin.left},${cargoBaseY})`)
    .call(d3.axisLeft(yCargo).ticks(5)).attr('color', '#94a3b8');

  svg.append('g')
    .attr('transform', `translate(${margin.left},${vesselBaseY})`)
    .call(d3.axisLeft(yVessel).ticks(5)).attr('color', '#94a3b8');

  // Y axis Cargo title
  svg.append('text')
  .attr('class', 'y-axis-title')
  .attr('text-anchor', 'middle')
  .attr('transform', `rotate(-90)`)
  .attr('y', margin.left / 4)
  .attr('x', -(margin.top + chartHeight / 2)) 
  .text('Cargo weight (Tons)');

  // Y axis Vessels title
  svg.append('text')
    .attr('class', 'y-axis-title')
    .attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`)
    .attr('y', margin.left / 4)
    .attr('x', -(vesselBaseY + chartHeight / 2))
    .text('Vessel tonnage (GT)');

  // Apply Zoom
  svg.call(zoom);
}

onMounted(loadData);
watch(() => props.selectedHarbor, () => { 
  currentTransform.value = d3.zoomIdentity; 
  brushRange.value = null;
  renderChart(); 
});
watch([hiddenCommodities, hiddenVesselTypes], renderChart, { deep: true });
</script>

<template>
  <div class="w-full h-full flex flex-col gap-4 overflow-hidden p-2 bg-slate-50">
    
    <div class="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div class="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-gray-50">
        <span class="text-[10px] font-black text-gray-400 uppercase shrink-0">Cargo</span>
        <div v-for="id in [...new Set(rawCargo.map(d => d.commodity))].sort()" :key="id"
          @click="hiddenCommodities.has(id) ? hiddenCommodities.delete(id) : hiddenCommodities.add(id)"
          class="legend-item" :class="{ 'inactive': hiddenCommodities.has(id) }">
          <div class="dot" :style="{ backgroundColor: illegalCommodities.has(id) ? '#ef4444' : '#3b82f6' }"></div>
          <span class="label" :class="{ 'illegal': illegalCommodities.has(id) }">{{ commodityNames[id] || id }}</span>
        </div>
      </div>

      <div class="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar pt-1">
        <span class="text-[10px] font-black text-gray-400 uppercase shrink-0">Vessels</span>
        <div v-for="type in [...new Set(rawVessels.map(v => v.vessel_type))].sort()" :key="type"
          @click="hiddenVesselTypes.has(type) ? hiddenVesselTypes.delete(type) : hiddenVesselTypes.add(type)"
          class="legend-item" :class="{ 'inactive': hiddenVesselTypes.has(type) }">
          <div class="dot" :style="{ backgroundColor: vesselColorMap[type] }"></div>
          <span class="label text-slate-600">{{ type }}</span>
        </div>
      </div>
    </div>

    <div class="flex-grow flex gap-4 min-h-0">
      
      <div class="flex-[3] relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div ref="chartContainer" class="w-full h-full cursor-crosshair"></div>
        <Tooltip v-bind="tooltip" />
      </div>

      <div ref="sidebarRef" 
        class="flex-[1] flex flex-col h-full min-w-[260px] relative select-none overflow-hidden"
      >
        <div v-if="isResizing" 
          class="fixed inset-0 z-[9999] cursor-row-resize"
          @mousemove="handleMouseMove"
          @mouseup="stopResizing"
        ></div>

        <div 
          class="flex flex-col bg-white rounded-t-xl border border-gray-200 shadow-sm overflow-hidden min-h-0"
          :style="{ height: topBoxHeight + '%', maxHeight: topBoxHeight + '%' }" 
        >
          <div class="p-3 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 class="text-[10px] font-black uppercase text-slate-600">Cargo in View</h3>
            <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
              {{ cargoInView.length }}
            </span>
          </div>

          <div class="flex-grow overflow-y-auto p-2 flex flex-col gap-2 no-scrollbar bg-slate-50/10">
            <div v-if="cargoInView.length === 0" class="h-full flex items-center justify-center text-center p-4">
              <p class="text-[9px] text-slate-400 uppercase font-bold">Shift+Drag on the chart</p>
            </div>
            <div v-for="(cargo, idx) in cargoInView" :key="'c-'+idx" 
                class="flex flex-col rounded-lg border border-slate-100 bg-white shadow-sm shrink-0 transition-all overflow-hidden"
                :class="{ 
                  'border-red-300 ring-1 ring-red-100': illegalCommodities.has(cargo.commodity),
                  'border-blue-300 shadow-md': expandedCargoId === cargo.id 
                }">
              
              <div @click="toggleCargoExpansion(cargo.id)" 
                  class="p-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-start mb-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[8px] transition-transform duration-200"
                          :class="{ 'rotate-180': expandedCargoId === cargo.id }">▼</span>
                    <span class="text-[10px] font-black text-slate-800" 
                          :class="{ 'text-red-700': illegalCommodities.has(cargo.commodity) }">
                      {{ commodityNames[cargo.commodity] || cargo.commodity }}
                    </span>
                  </div>
                  <span class="text-[8px] font-mono text-slate-400">{{ cargo.date.toLocaleDateString() }}</span>
                </div>

                <div class="flex justify-between items-center ml-4">
                  <span class="text-[9px] font-bold text-slate-500 italic">{{ cargo.qty.toFixed(1) }} Tons</span>
                  <div class="flex gap-2 items-center">
                    <span v-if="cargo.suspected_vessels?.length" class="text-[7px] font-bold text-blue-500 uppercase">
                      {{ cargo.suspected_vessels.length }} Suspects
                    </span>
                    <span v-if="illegalCommodities.has(cargo.commodity)" class="text-[8px] font-black text-red-600 uppercase">⚠️ Illegal</span>
                  </div>
                </div>
              </div>

              <div v-if="expandedCargoId === cargo.id" 
                  class="bg-slate-50 border-t border-slate-100 p-2 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
                <h4 class="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Suspected Vessels:</h4>
                
                <div v-if="!cargo.suspected_vessels || cargo.suspected_vessels.length === 0" class="text-[9px] italic text-slate-400">
                  No suspected vessels recorded.
                </div>

                <div v-for="vId in cargo.suspected_vessels" :key="vId" 
                    class="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200">
                  <div class="flex flex-col">
                    <span class="text-[9px] font-bold text-slate-700">{{ vesselLookup[vId]?.name || vId }}</span>
                    <span class="text-[8px] text-slate-500">{{ vesselLookup[vId]?.company || 'Unknown Company' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div 
          @mousedown.prevent="startResizing"
          @dblclick="topBoxHeight = 50"
          class="h-1.5 w-full hover:bg-blue-400 cursor-row-resize flex items-center justify-center transition-colors group bg-gray-50 border-x border-gray-200"
          :class="{ 'bg-blue-600': isResizing }"
          title="Drag to resize, Double-click to reset (50/50)"
        >
          <div class="w-10 h-1 bg-gray-300 rounded-full group-hover:bg-white transition-colors"></div>
        </div>

        <div 
          class="flex flex-col bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden min-h-0"
          :style="{ height: (100 - topBoxHeight) + '%', maxHeight: (100 - topBoxHeight) + '%' }"
        > 
          <div class="p-3 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 class="text-[10px] font-black uppercase text-slate-600">Vessels in View</h3>
            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
              {{ vesselsInView.length }}
            </span>
          </div>

          <div class="flex-grow overflow-y-auto p-2 flex flex-col gap-2 no-scrollbar bg-slate-50/10">
            <div v-if="vesselsInView.length === 0" class="h-full flex items-center justify-center text-center p-4">
              <p class="text-[9px] text-slate-400 uppercase font-bold">Shift+Drag on the chart</p>
            </div>
            <div v-for="(vessel, idx) in vesselsInView" :key="'v-'+idx" 
                class="p-2.5 rounded-lg border border-slate-100 bg-white shadow-sm shrink-0">
              <div class="flex justify-between items-start mb-1">

                <div class="flex flex-wrap items-center gap-1">
                  <span class="text-[10px] font-black text-slate-800 truncate ">{{ vessel.name }}</span>
                  <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: vesselColorMap[vessel.vessel_type] }"></div>
                    <span class="text-[8px] font-bold text-slate-500 uppercase">{{ vessel.vessel_type }}</span>
                  </div>
                </div>
                
                <span class="text-[8px] font-mono text-slate-400">{{ vessel.date.toLocaleDateString() }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                
                <span class="text-[9px] text-slate-500">{{ vessel.company }}</span>
                <span class="text-[9px] text-slate-500">| Tonnage: {{ vessel.tonnage.toFixed(1) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>
.legend-item {
  flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 4px 10px;
  background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 6px;
  cursor: pointer; transition: 0.2s; user-select: none;
}
.legend-item.inactive { opacity: 0.15; filter: grayscale(1); }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #334155; }
.label.illegal { color: #b91c1c; }

.no-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.no-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

:deep(.brush .overlay) { cursor: crosshair; }
:deep(.brush .selection) {
  fill: #3b82f6; fill-opacity: 0.15;
  stroke: #2563eb; stroke-width: 1px; stroke-dasharray: 2,2;
}

:deep(.y-axis-title) {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  fill: #64748b; letter-spacing: 0.05em;
}

.select-none { user-select: none; }
.cursor-row-resize { cursor: row-resize !important; }

.animate-in { animation: slideIn 0.2s ease-out; }
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>