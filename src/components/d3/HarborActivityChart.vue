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

const tooltip = reactive({ x: 0, y: 0, contentDict: null, visible: false, variant: 'default' });

// --- Configuration for Responsive Fitting ---
const margin = { top: 20, right: 30, bottom: 20, left: 80 };
const chartHeight = 220; 
const gap = 40; // Central space for the X-axis
const logicalWidth = 1000; 
const logicalHeight = (chartHeight * 2) + margin.top + margin.bottom + gap;

let x; // Shared X scale

// --- Tooltip Logic ---
function showTooltip(event, d, type = 'cargo') {
  tooltip.x = event.clientX + 15;
  tooltip.y = event.clientY + 15;
  
  if (type === 'cargo') {
    const isIllegal = illegalCommodities.has(d.commodity);
    tooltip.contentDict = {
      'Category': 'CARGO IMPORT',
      'Species': commodityNames.value[d.commodity] || d.commodity,
      'Weight': `${d.qty.toFixed(2)} tons`,
      'Date': d.date.toLocaleDateString(),
      'Status': isIllegal ? '⚠️ ILLEGAL' : 'Verified'
    };
    tooltip.variant = isIllegal ? 'danger' : 'default';
  } else {
    tooltip.contentDict = {
      'Category': 'VESSEL ARRIVAL',
      'Name': d.name,
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
    const vesselLookup = Object.fromEntries(vessels.map(v => [v.id, v]));
    rawVessels.value = reports.map(r => {
      const vesselDetail = vesselLookup[r.source];
      return {
        ...r, date: new Date(r.date),
        name: vesselDetail?.name || 'Unknown',
        vessel_type: vesselDetail?.vessel_type || 'Unknown Type',
        tonnage: parseFloat(vesselDetail?.tonnage) || 0
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

// --- D3 Specular Rendering ---
async function renderChart() {
  await nextTick();
  if (!chartContainer.value) return;
  const container = d3.select(chartContainer.value);
  container.selectAll('*').remove();
  if (!props.selectedHarbor) return;

  const totalHeight = (chartHeight * 2) + margin.top + margin.bottom + gap;
  
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${logicalWidth + margin.left + margin.right} ${logicalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%')
    .style('display', 'block');

  const allDates = [...filteredCargo.value.map(d => d.date), ...filteredVessels.value.map(d => d.date)];
  x = d3.scaleTime().domain(d3.extent(allDates)).range([0, logicalWidth]);

  // --- TOP: CARGO (GROW UP) ---
  const gCargo = svg.append('g').attr('transform', `translate(${margin.left},${margin.top + chartHeight})`);
  const yCargo = d3.scaleLinear()
    .domain([0, d3.max(filteredCargo.value, d => d.y1) * 1.1 || 100])
    .range([0, -chartHeight]);

  gCargo.append('g').call(d3.axisLeft(yCargo).ticks(5)).attr('color', '#94a3b8');
  const cargoColor = d3.scaleOrdinal(d3.schemeTableau10);

  gCargo.selectAll('.bar-cargo').data(filteredCargo.value).enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yCargo(d.y1))
    .attr('width', 6)
    .attr('height', d => Math.abs(yCargo(d.y1) - yCargo(d.y0)))
    .attr('fill', d => illegalCommodities.has(d.commodity) ? '#ef4444' : cargoColor(d.commodity))
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'cargo')).on('mouseleave', hideTooltip);

  // --- BOTTOM: VESSELS (GROW DOWN) ---
  const gVessel = svg.append('g').attr('transform', `translate(${margin.left},${margin.top + chartHeight + gap})`);
  const yVessel = d3.scaleLinear()
    .domain([0, d3.max(filteredVessels.value, d => d.y1) * 1.1 || 100])
    .range([0, chartHeight]);

  gVessel.append('g').call(d3.axisLeft(yVessel).ticks(5)).attr('color', '#94a3b8');

  gVessel.selectAll('.bar-vessel').data(filteredVessels.value).enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yVessel(d.y0)) // Start at base and grow down
    .attr('width', 6)
    .attr('height', d => Math.abs(yVessel(d.y1) - yVessel(d.y0)))
    .attr('fill', d => vesselColorMap.value[d.vessel_type] || '#ccc')
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'vessel')).on('mouseleave', hideTooltip);

  // --- CENTER SHARED X-AXIS ---
  gCargo.append('g').attr('class', 'x-axis').call(d3.axisBottom(x).ticks(10));

  // --- ZOOM ---
  const zoom = d3.zoom().scaleExtent([1, 100]).on('zoom', (event) => {
    currentTransform.value = event.transform;
    const newX = event.transform.rescaleX(x);
    svg.selectAll('.x-axis').call(d3.axisBottom(newX));
    svg.selectAll('.bar-element').attr('x', d => newX(d.date) - 3);
  });
  svg.call(zoom).call(zoom.transform, currentTransform.value);
}

onMounted(loadData);
watch(() => props.selectedHarbor, () => { currentTransform.value = d3.zoomIdentity; renderChart(); });
watch([hiddenCommodities, hiddenVesselTypes], renderChart, { deep: true });
</script>

<template>
  <div class="w-full h-full flex flex-col gap-4">
    <div class="flex flex-col gap-2 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
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

    <div class="flex-grow min-h-0 relative bg-white rounded-xl border border-gray-50 overflow-hidden">
      <div class="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-32 pointer-events-none opacity-40">
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-black uppercase text-blue-500">Imports</span>
          <span class="text-xs">↑</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-xs">↓</span>
          <span class="text-[9px] font-black uppercase text-emerald-500">Traffic</span>
        </div>
      </div>
      
      <div ref="chartContainer" class="w-full h-full cursor-crosshair"></div>
      <Tooltip v-bind="tooltip" />
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
.no-scrollbar::-webkit-scrollbar { height: 4px; }
.no-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
</style>