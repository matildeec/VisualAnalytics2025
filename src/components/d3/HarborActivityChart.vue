<script setup>
import * as d3 from 'd3';
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import Tooltip from '../Tooltip.vue';
import { 
    getVesselColor, 
    getCommodityColor, 
    getCommodityStatus,
    showTooltip,
    hideTooltip
} from './utils.js';

const props = defineProps({ 
  selectedHarbor: String,
  cargoData: { type: Array, default: () => [] },
  vesselData: { type: Array, default: () => [] },
  commodityNames: { type: Object, default: () => ({}) },
  vesselLookup: { type: Object, default: () => ({}) }, // Serve per i tooltip
  hiddenCommodities: { type: Set, default: () => new Set() },
  hiddenVesselTypes: { type: Set, default: () => new Set() }
});

const emit = defineEmits(['view-updated']);

const chartContainer = ref(null);
const currentTransform = ref(d3.zoomIdentity);
const brushRange = ref(null);
const tooltip = ref({ 
    x: 0, 
    y: 0, 
    contentDict: null, 
    visible: false, 
    variant: 'default' 
});

const margin = { top: 20, right: 30, bottom: 20, left: 80 };
const chartHeight = 280; 
const gap = 30; 
const logicalWidth = 1000; 
const logicalHeight = (chartHeight * 2) + margin.top + margin.bottom + gap;
let x; // Scala X globale per zoom/brush

const cargoInView = computed(() => {
  if (!props.selectedHarbor || !props.cargoData.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return props.cargoData
    .filter(d => {
      const isInHarbor = d.target === props.selectedHarbor;
      const isNotFiltered = !props.hiddenCommodities.has(d.commodity);
      const isInBrush = d.date >= minDate && d.date <= maxDate;
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

const vesselsInView = computed(() => {
  if (!props.selectedHarbor || !props.vesselData.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return props.vesselData
    .filter(v => {
      const isInHarbor = v.target === props.selectedHarbor;
      const isNotFiltered = !props.hiddenVesselTypes.has(v.vessel_type);
      const isInBrush = v.date >= minDate && v.date <= maxDate; 
      return isInHarbor && isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

// Emettiamo al padre cosa stiamo vedendo (per la sidebar)
watch([cargoInView, vesselsInView], ([newCargo, newVessels]) => {
  emit('view-updated', { cargo: newCargo, vessels: newVessels });
});

// --- Logica Mirror Stacking (Preparazione dati per D3) ---
const filteredCargoStack = computed(() => {
  if (!props.selectedHarbor) return [];
  // Filtra per porto e checkbox, ma NON per brush (il grafico mostra tutto, il brush seleziona)
  const active = props.cargoData.filter(d => d.target === props.selectedHarbor && !props.hiddenCommodities.has(d.commodity));
  
  const stacks = []; 
  const dayTracker = {};
  
  // Ordina e impila
  active.sort((a,b) => a.date - b.date).forEach(d => {
    const day = d.date.toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    stacks.push({ ...d, y0: base, y1: base + d.qty });
    dayTracker[day] = base + d.qty;
  });
  return stacks;
});

const filteredVesselStack = computed(() => {
  if (!props.selectedHarbor) return [];
  const active = props.vesselData.filter(v => v.target === props.selectedHarbor && !props.hiddenVesselTypes.has(v.vessel_type));
  
  const stacks = []; 
  const dayTracker = {};
  
  active.sort((a,b) => a.vessel_type.localeCompare(b.vessel_type) || a.date - b.date).forEach(v => {
    const day = v.date.toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    stacks.push({ ...v, y0: base, y1: base + v.tonnage });
    dayTracker[day] = base + v.tonnage;
  });
  return stacks;
});

// --- Tooltip Logic ---
function handleTooltip(event, d, type = 'cargo') {
  let content = {};
  let variant = 'default';

  if (type === 'cargo') {
    const status = getCommodityStatus(d.commodity);
    let statusText = 'Verified';
    if (status === 'illegal') statusText = 'ILLEGAL';
    if (status === 'suspect') statusText = 'Suspect';

    content = {
      'Commodity': props.commodityNames[d.commodity] || d.commodity,
      'Weight': `${d.qty.toFixed(2)} tons`,
      'Date': d.date.toLocaleDateString(),
      'Status': statusText
    };
    variant = status === 'illegal' ? 'danger' : (status === 'suspect' ? 'warning' : 'default');
  } else {
    content = { 
        'Vessel': d.name, 
        'Type': d.vessel_type, 
        'Tonnage': `${d.tonnage.toFixed(2)} tons`, 
        'Date': d.date.toLocaleDateString() 
    };
  }

  showTooltip(event, content, tooltip, variant);
}

// --- Render Chart (D3) ---
async function renderChart() {
  await nextTick(); // Aspetta che Vue aggiorni il DOM
  
  if (!chartContainer.value || !props.selectedHarbor || props.cargoData.length === 0) {
    if(chartContainer.value) d3.select(chartContainer.value).selectAll('*').remove();
    return;
  }

  const container = d3.select(chartContainer.value);
  container.selectAll('*').remove();

  // Calcoli Layout
  const cargoBaseY = margin.top + chartHeight; 
  const vesselBaseY = cargoBaseY + gap;       
  const totalChartHeight = (chartHeight * 2) + gap;

  // SVG Setup
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${logicalWidth + margin.left + margin.right} ${logicalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('height', '100%').style('display', 'block');

  // Clips
  const defs = svg.append('defs');
  defs.append('clipPath').attr('id', 'chart-content-clip').append('rect')
    .attr('x', 0).attr('y', -chartHeight).attr('width', logicalWidth).attr('height', chartHeight * 2 + gap);

  // Scales
  const allDates = [...filteredCargoStack.value.map(d => d.date), ...filteredVesselStack.value.map(d => d.date)];
  const dateExtent = allDates.length ? d3.extent(allDates) : [new Date('2024-01-01'), new Date('2024-12-31')];
  
  x = d3.scaleTime().domain(dateExtent).range([0, logicalWidth]);

  const yCargo = d3.scaleLinear()
      .domain([0, d3.max(filteredCargoStack.value, d => d.y1) * 1.1 || 100])
      .range([0, -chartHeight]);
  
  const yVessel = d3.scaleLinear()
      .domain([0, d3.max(filteredVesselStack.value, d => d.y1) * 1.1 || 100])
      .range([0, chartHeight]);

  // --- Grid & Axes Drawing (Semplificato per brevità, mantieni la tua logica esistente) ---
  const gGrid = svg.append('g').attr('class', 'grid-layer');

  // --- Brush & Zoom ---
  const brush = d3.brushX().extent([[0, 0], [logicalWidth, totalChartHeight]])
    .filter(event => event.shiftKey) // Brush solo con Shift
    .on('brush end', (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection;
        const activeX = currentTransform.value.rescaleX(x);
        brushRange.value = [activeX.invert(x0), activeX.invert(x1)];
      } else { brushRange.value = null; }
    });

  const zoom = d3.zoom().scaleExtent([1, 100])
    .filter(event => !event.shiftKey) // Zoom senza Shift
    .on('zoom', (event) => {
      currentTransform.value = event.transform;
      const newX = event.transform.rescaleX(x);
      
      // Update Axis & Grid
      svg.selectAll('.x-axis').call(d3.axisBottom(newX));
      // ... update grid ...
      
      // Update Bars
      svg.selectAll('.bar-element').attr('x', d => newX(d.date) - 3);
      
      // Reset Brush visual
      svg.select(".brush").call(brush.move, null); 
      brushRange.value = null;
    });

  svg.append('g').attr('class', 'brush').attr('transform', `translate(${margin.left},${margin.top})`).call(brush);

  // --- Draw Bars ---
  const gCargo = svg.append('g').attr('transform', `translate(${margin.left},${cargoBaseY})`).attr('clip-path', 'url(#chart-content-clip)');
  gCargo.selectAll('.bar-cargo')
    .data(filteredCargoStack.value)
    .enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yCargo(d.y1))
    .attr('width', 6)
    .attr('height', d => Math.abs(yCargo(d.y1) - yCargo(d.y0)))
    .attr('fill', d => getCommodityColor(d.commodity))
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => handleTooltip(e, d, 'cargo')).on('mouseleave', hideTooltip (tooltip));

  const gVessel = svg.append('g').attr('transform', `translate(${margin.left},${vesselBaseY})`).attr('clip-path', 'url(#chart-content-clip)');
  gVessel.selectAll('.bar-vessel')
    .data(filteredVesselStack.value)
    .enter().append('rect')
    .attr('class', 'bar-element')
    .attr('x', d => x(d.date) - 3)
    .attr('y', d => yVessel(d.y0))
    .attr('width', 6)
    .attr('height', d => Math.abs(yVessel(d.y1) - yVessel(d.y0)))
    .attr('fill', d => getVesselColor(d.vessel_type))
    .attr('stroke', 'black').attr('stroke-width', 0.2)
    .on('mouseenter', (e, d) => handleTooltip(e, d, 'vessel')).on('mouseleave', hideTooltip (tooltip));

  // Axes Calls (Bottom X Axis)
  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(${margin.left},${cargoBaseY})`)
     .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0));
  
  // Y Axes
  svg.append('g').attr('transform', `translate(${margin.left},${cargoBaseY})`).call(d3.axisLeft(yCargo).ticks(5));
  svg.append('g').attr('transform', `translate(${margin.left},${vesselBaseY})`).call(d3.axisLeft(yVessel).ticks(5));

  // Labels
  svg.append('text').attr('transform', `rotate(-90)`).attr('y', margin.left/4).attr('x', -(margin.top + chartHeight/2))
     .text('Cargo weight (Tons)').attr('text-anchor', 'middle').style('font-size', '10px').style('fill', 'var(--chart-axis-line)').style('font-weight', 'bold');
  
  svg.append('text').attr('transform', `rotate(-90)`).attr('y', margin.left/4).attr('x', -(vesselBaseY + chartHeight/2))
     .text('Vessel tonnage (GT)').attr('text-anchor', 'middle').style('font-size', '10px').style('fill', 'var(--chart-axis-line)').style('font-weight', 'bold');

  svg.call(zoom);
}

// --- Watchers: Reagire ai cambiamenti delle Props ---
// Se i dati, il porto o i filtri cambiano, ridisegna il grafico
watch(
  [() => props.cargoData, () => props.vesselData, () => props.selectedHarbor, () => props.hiddenCommodities, () => props.hiddenVesselTypes], 
  renderChart, 
  { deep: true }
);

// Window resize handler
const onResize = () => renderChart();
onMounted(() => {
    window.addEventListener('resize', onResize);
    renderChart(); // Primo render se i dati sono già lì
});
onUnmounted(() => window.removeEventListener('resize', onResize));

</script>

<template>
  <div class="relative w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div v-if="!props.selectedHarbor" class="absolute inset-0 flex items-center justify-center text-gray-400">
          Select a harbor to view data
      </div>

      <div ref="chartContainer" class="w-full h-full cursor-crosshair"></div>
      <Tooltip v-bind="tooltip" />
  </div>
</template>