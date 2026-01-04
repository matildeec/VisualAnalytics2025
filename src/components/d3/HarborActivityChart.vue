<script setup>
import * as d3 from 'd3';
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue';
import { illegalCommodities } from './utils.js';
import Tooltip from '../Tooltip.vue';
import LoadingOverlay from '../LoadingOverlay.vue';

const props = defineProps({ 
  selectedHarbor: String,
  hiddenCommodities: { type: Set, default: () => new Set() },
  hiddenVesselTypes: { type: Set, default: () => new Set() }
});

const emit = defineEmits(['data-loaded', 'view-updated']);

// --- Data & Refs ---
const chartContainer = ref(null);
const isLoading = ref(true);
const rawCargo = ref([]);
const rawVessels = ref([]);
const commodityNames = ref({});
const vesselColorMap = ref({});
const currentTransform = ref(d3.zoomIdentity);
const brushRange = ref(null);

// --- Computed: Vessels & Cargo in View ---
const vesselsInView = computed(() => {
  if (!props.selectedHarbor || !rawVessels.value.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return rawVessels.value
    .filter(v => {
      const isInHarbor = v.target === props.selectedHarbor;
      const isNotFiltered = !props.hiddenVesselTypes.has(v.vessel_type);
      const isInBrush = v.date >= minDate && v.date <= maxDate; 
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

const cargoInView = computed(() => {
  if (!props.selectedHarbor || !rawCargo.value.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return rawCargo.value
    .filter(d => {
      const isInHarbor = d.target === props.selectedHarbor;
      const isNotFiltered = !props.hiddenCommodities.has(d.commodity);
      const isInBrush = d.date >= minDate && d.date <= maxDate;
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

// --- Watcher per comunicare al Parent cosa è visibile ---
watch([cargoInView, vesselsInView], ([newCargo, newVessels]) => {
  emit('view-updated', { cargo: newCargo, vessels: newVessels });
});

// --- Configurazione Chart ---
const margin = { top: 20, right: 30, bottom: 20, left: 80 };
const chartHeight = 280; 
const gap = 30; 
const logicalWidth = 1000; 
const logicalHeight = (chartHeight * 2) + margin.top + margin.bottom + gap;
let x; 
const vesselLookup = ref({});
const tooltip = reactive({ x: 0, y: 0, contentDict: null, visible: false, variant: 'default' });

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
    tooltip.contentDict = { 'Vessel': d.name, 'Type': d.vessel_type, 'Tonnage': `${d.tonnage.toFixed(2)} tons`, 'Date': d.date.toLocaleDateString() };
    tooltip.variant = 'default';
  }
  tooltip.visible = true;
}
function hideTooltip() { tooltip.visible = false; }

// --- Data Loading ---
async function loadData() {
  isLoading.value = true;
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

    rawCargo.value = trans.map(t => {
      const cargoDetail = docMap[t.source];
      return { ...t, date: new Date(t.date), commodity: cargoDetail ? cargoDetail.commodity : 'unknown', qty: cargoDetail ? parseFloat(cargoDetail.qty_tons) : 0 };
    }).filter(d => d.qty > 0);

    vesselLookup.value = Object.fromEntries(vessels.map(v => [v.id, v]));

    rawVessels.value = reports.map(r => {
      const vesselDetail = vesselLookup.value[r.source];
      return { ...r, date: new Date(r.date), name: vesselDetail?.name || 'Unknown', vessel_type: vesselDetail?.vessel_type || 'Unknown Type', tonnage: parseFloat(vesselDetail?.tonnage) || 0, company: vesselDetail?.company || 'Unknown Company' };
    }).filter(v => v.tonnage > 0);

    const uniqueCommodities = [...new Set(rawCargo.value.map(d => d.commodity))].sort();
    const uniqueVesselTypes = [...new Set(rawVessels.value.map(v => v.vessel_type))].sort();
    const availableHarbors = Array.from(new Set(rawCargo.value.map(d => d.target))).sort();

    const vScale = d3.scaleOrdinal(d3.schemeSet2).domain(uniqueVesselTypes);
    vesselColorMap.value = Object.fromEntries(uniqueVesselTypes.map(t => [t, vScale(t)]));

    emit('data-loaded', {
      harbors: availableHarbors,
      commodities: uniqueCommodities,
      vesselTypes: uniqueVesselTypes,
      commodityNames: commodityNames.value,
      vesselColorMap: vesselColorMap.value,
      vesselLookup: vesselLookup.value // Passiamo anche questo per i dettagli espansi
    });

    await renderChart();
  } catch (err) { 
    console.error("Data fetch error:", err); 
    isLoading.value = false;
  }
}

// --- Mirror Stacking Logic ---
const filteredCargo = computed(() => {
  if (!props.selectedHarbor) return [];
  const active = rawCargo.value.filter(d => d.target === props.selectedHarbor && !props.hiddenCommodities.has(d.commodity));
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
  const active = rawVessels.value.filter(v => v.target === props.selectedHarbor && !props.hiddenVesselTypes.has(v.vessel_type));
  const stacks = []; const dayTracker = {};
  active.sort((a,b) => a.vessel_type.localeCompare(b.vessel_type) || a.date - b.date).forEach(v => {
    const day = v.date.toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    stacks.push({ ...v, y0: base, y1: base + v.tonnage });
    dayTracker[day] = base + v.tonnage;
  });
  return stacks;
});

// --- Render Chart ---
async function renderChart() {
  isLoading.value = true;
  await nextTick();
  if (props.selectedHarbor) await new Promise(resolve => setTimeout(resolve, 200));

  if (!chartContainer.value || !props.selectedHarbor) {
    isLoading.value = false;
    if(chartContainer.value) d3.select(chartContainer.value).selectAll('*').remove();
    return;
  }

  const container = d3.select(chartContainer.value);
  container.selectAll('*').remove();

  const cargoBaseY = margin.top + chartHeight; 
  const vesselBaseY = cargoBaseY + gap;       
  const totalChartHeight = (chartHeight * 2) + gap;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${logicalWidth + margin.left + margin.right} ${logicalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('height', '100%').style('display', 'block');

  const defs = svg.append('defs');
  defs.append('clipPath').attr('id', 'chart-content-clip').append('rect')
    .attr('x', 0).attr('y', -chartHeight).attr('width', logicalWidth).attr('height', chartHeight * 2 + gap);

  const allDates = [...filteredCargo.value.map(d => d.date), ...filteredVessels.value.map(d => d.date)];
  x = d3.scaleTime().domain(d3.extent(allDates)).range([0, logicalWidth]);

  const yCargo = d3.scaleLinear().domain([0, d3.max(filteredCargo.value, d => d.y1) * 1.1 || 100]).range([0, -chartHeight]);
  const yVessel = d3.scaleLinear().domain([0, d3.max(filteredVessels.value, d => d.y1) * 1.1 || 100]).range([0, chartHeight]);

  const gGrid = svg.append('g').attr('class', 'grid-layer');
  const gridAxisX = d3.axisTop(x).ticks(logicalWidth / 80).tickSize(-totalChartHeight).tickFormat('').tickSizeOuter(0);
  const gGridVertical = gGrid.append('g').attr('class', 'grid-vertical').attr('transform', `translate(${margin.left}, ${margin.top})`)
      .attr('opacity', 0.5).call(gridAxisX);
  gGridVertical.selectAll('line').attr('stroke', '#e2e8f0').attr('stroke-dasharray', '2,2');
  gGridVertical.select('.domain').remove();

  const gGridHorizontalCargo = gGrid.append('g').attr('transform', `translate(${margin.left}, ${cargoBaseY})`).attr('opacity', 0.3)
      .call(d3.axisLeft(yCargo).ticks(5).tickSize(-logicalWidth).tickFormat(''));
  gGridHorizontalCargo.selectAll('line').attr('stroke', '#e2e8f0'); gGridHorizontalCargo.select('.domain').remove();

  const gGridHorizontalVessel = gGrid.append('g').attr('transform', `translate(${margin.left}, ${vesselBaseY})`).attr('opacity', 0.3)
      .call(d3.axisLeft(yVessel).ticks(5).tickSize(-logicalWidth).tickFormat(''));
  gGridHorizontalVessel.selectAll('line').attr('stroke', '#e2e8f0'); gGridHorizontalVessel.select('.domain').remove();

  const brush = d3.brushX().extent([[0, 0], [logicalWidth, (chartHeight * 2) + gap]])
    .filter(event => event.shiftKey)
    .on('brush end', (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection;
        const activeX = currentTransform.value.rescaleX(x);
        brushRange.value = [activeX.invert(x0), activeX.invert(x1)];
      } else { brushRange.value = null; }
    });

  const zoom = d3.zoom().scaleExtent([1, 100]).filter(event => !event.shiftKey).on('zoom', (event) => {
      currentTransform.value = event.transform;
      const newX = event.transform.rescaleX(x);
      svg.selectAll('.x-axis').call(d3.axisBottom(newX));
      gGridVertical.call(gridAxisX.scale(newX));
      gGridVertical.selectAll('line').attr('stroke', '#e2e8f0').attr('stroke-dasharray', '2,2'); gGridVertical.select('.domain').remove();
      svg.selectAll('.bar-element').attr('x', d => newX(d.date) - 3);
      svg.select(".brush").call(brush.move, null); brushRange.value = null;
    });

  svg.append('g').attr('class', 'brush').attr('transform', `translate(${margin.left},${margin.top})`).call(brush);

  const gCargo = svg.append('g').attr('transform', `translate(${margin.left},${cargoBaseY})`).attr('clip-path', 'url(#chart-content-clip)');
  gCargo.selectAll('.bar-cargo').data(filteredCargo.value).enter().append('rect')
    .attr('class', 'bar-element').attr('x', d => x(d.date) - 3).attr('y', d => yCargo(d.y1)).attr('width', 6).attr('height', d => Math.abs(yCargo(d.y1) - yCargo(d.y0)))
    .attr('fill', d => illegalCommodities.has(d.commodity) ? '#ef4444' : '#3b82f6').attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'cargo')).on('mouseleave', hideTooltip);

  const gVessel = svg.append('g').attr('transform', `translate(${margin.left},${vesselBaseY})`).attr('clip-path', 'url(#chart-content-clip)');
  gVessel.selectAll('.bar-vessel').data(filteredVessels.value).enter().append('rect')
    .attr('class', 'bar-element').attr('x', d => x(d.date) - 3).attr('y', d => yVessel(d.y0)).attr('width', 6).attr('height', d => Math.abs(yVessel(d.y1) - yVessel(d.y0)))
    .attr('fill', d => vesselColorMap.value[d.vessel_type] || '#ccc').attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => showTooltip(e, d, 'vessel')).on('mouseleave', hideTooltip);

  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(${margin.left},${cargoBaseY})`).call(d3.axisBottom(x).ticks(10).tickSizeOuter(0)).attr('color', 'slategray');
  svg.append('g').attr('transform', `translate(${margin.left},${cargoBaseY})`).call(d3.axisLeft(yCargo).ticks(5)).attr('color', '#64748b');
  svg.append('g').attr('transform', `translate(${margin.left},${vesselBaseY})`).call(d3.axisLeft(yVessel).ticks(5)).attr('color', '#64748b');

  svg.append('text').attr('class', 'y-axis-title').attr('text-anchor', 'middle').attr('transform', `rotate(-90)`).attr('y', margin.left / 4).attr('x', -(margin.top + chartHeight / 2)).text('Cargo weight (Tons)');
  svg.append('text').attr('class', 'y-axis-title').attr('text-anchor', 'middle').attr('transform', `rotate(-90)`).attr('y', margin.left / 4).attr('x', -(vesselBaseY + chartHeight / 2)).text('Vessel tonnage (GT)');

  svg.call(zoom);
  isLoading.value = false;
}

onMounted(loadData);
watch(() => props.selectedHarbor, () => { currentTransform.value = d3.zoomIdentity; brushRange.value = null; renderChart(); });
watch([() => props.hiddenCommodities, () => props.hiddenVesselTypes], renderChart, { deep: true });
</script>

<template>
  <div class="relative w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      
      <LoadingOverlay :loading="isLoading" message="Loading Visualization..." />

      <div ref="chartContainer" class="w-full h-full cursor-crosshair"></div>
      <Tooltip v-bind="tooltip" />
  </div>
</template>

<style scoped>
:deep(.brush .overlay) { cursor: crosshair; }
:deep(.brush .selection) { fill: #3b82f6; fill-opacity: 0.1; stroke: #2563eb; stroke-width: 1px; stroke-dasharray: 4,2; }
:deep(.y-axis-title) { font-size: 10px; font-weight: 800; text-transform: uppercase; fill: #64748b; letter-spacing: 0.05em; }
</style>