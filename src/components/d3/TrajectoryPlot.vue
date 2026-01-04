<script setup>
import * as d3 from 'd3'
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { loadDocumentsMap, fishIcons, illegalCommodities, getZoneFill, getZoneBorder, showTooltip, hideTooltip } from './utils.js'
import Tooltip from '../Tooltip.vue'
import LoadingOverlay from '../LoadingOverlay.vue'

// --- Props & Refs ---
const props = defineProps({ selectedVesselId: String })
const isLoading = ref(true)
const plotContainer = ref(null)

// --- Chart Configuration & Globals ---
const margin = { top: 20, right: 40, bottom: 40, left: 120 }
const highlightDate = new Date('2035-05-14')
const currentTransform = ref(d3.zoomIdentity)

// --- Layer Visibility (Reactive) ---
const layers = reactive({
  pings: true,
  reports: true,
  cargo: true,
  event: true
})

// --- D3 Selections & Data Storage ---
let dwellGroup, reportGroup, cargoGroup, highZoneGroup
let x, y 
let allData = { 
  trajectories: null, 
  harborReports: null, 
  transactions: null, 
  documentsMap: null,
  commodityNames: {},
  locationKindMap: {},
  vessels: []
}

// --- Tooltip State ---
const tooltip = ref({ 
  x: 0, 
  y: 0, 
  contentDict: {}, 
  visible: false, 
  variant: 'default' 
})

function toggleLayer(group, visible) {
  if (!group) return
  group.transition().duration(200).style('opacity', visible ? 1 : 0)
}

// Initial Data Fetch: Loads all required JSON datasets and maps commodity IDs to names
async function initializeData() {
  isLoading.value = true;

  try {
    const [traj, reports, trans, vess, docMap, commList, locs] = await Promise.all([
      fetch('/data/trajectories.json').then(res => res.json()),
      fetch('/data/harbor_reports.json').then(res => res.json()),
      fetch('/data/transactions.json').then(res => res.json()),
      fetch('/data/vessels.json').then(res => res.json()),
      loadDocumentsMap(),
      fetch('/data/commodities.json').then(res => res.json()),
      fetch('/data/locations.json').then(res => res.json())
    ])

    // Map commodity list to a lookup object for O(1) access
    const commLookup = {}
    commList.forEach(c => { commLookup[c.id] = c.name })

    // Map location names to kinds to style
    const locKindMap = {}
    const uniqueLocs = new Set()

    locs.forEach(l => { 
      locKindMap[l.id] = l.kind || 'Unknown' 
      uniqueLocs.add(l.id)
    })

    const sortedLocs = Array.from(uniqueLocs).sort((a, b) => a.localeCompare(b))

    allData = { 
      trajectories: traj, 
      harborReports: reports, 
      transactions: trans, 
      vessels: vess,
      documentsMap: docMap,
      commodityNames: commLookup,
      locationKindMap: locKindMap,
      sortedLocations: sortedLocs
    }
    renderChart()
  } catch (err) { 
    console.error("Data load error:", err) 
  } finally {
    isLoading.value = false;
  }
}

const drawRichYAxis = (g) => {
  g.selectAll(".tick").each(function(d) {
    const tick = d3.select(this);
    
    tick.selectAll("text").remove(); 
    tick.selectAll(".rich-label").remove();

    const kind = allData.locationKindMap[d] || 'Unknown';

    const labelGroup = tick.append("g")
        .attr("class", "rich-label")
        .attr("transform", "translate(-10, 0)");

    labelGroup.append('text')
        .text(d.length > 20 ? d.substring(0, 20) + '...' : d)
        .attr('x', 0) 
        .attr('y', -4)
        .style('font-size', '10px')
        .style('fill', 'var(--chart-text-main')
        .style('text-anchor', 'end');

    labelGroup.append('text')
        .text(kind)
        .attr('x', 0)
        .attr('y', 4) // Sotto il nome
        .style('font-size', '8px')
        .style('font-style', 'italic')
        .style('fill', getZoneBorder(kind))
        .style('text-anchor', 'end');
  });
};

//Main Render Function: Handles SVG creation, scales, axes, and data layer drawing
function renderChart() {
  // Clear previous render
  if (plotContainer.value) {
    d3.select(plotContainer.value).selectAll('*').remove()
  }

  // Guard clause: ensure data and vessel selection exist
  if (!props.selectedVesselId || !allData.trajectories || !plotContainer.value) return

  const containerWidth = plotContainer.value.clientWidth
  const containerHeight = plotContainer.value.clientHeight
  const width = containerWidth - margin.left - margin.right
  const height = containerHeight - margin.top - margin.bottom

  const vesselId = props.selectedVesselId
  const rawVesselData = allData.trajectories[vesselId] || []
  
  // --- Data Formatting ---
  const vesselData = rawVesselData.map(d => ({
    ...d,
    time: new Date(d.time),
    end_time: new Date(new Date(d.time).getTime() + Number(d.dwell) * 1000)
  }))

  //const locations = Array.from(new Set(vesselData.map(d => d.source)))
  const locations = allData.sortedLocations

  const vesselReports = allData.harborReports
    .filter(r => r.source === vesselId && locations.includes(r.target))
    .map(r => ({
      ...r,
      day_start: new Date(new Date(r.date).setHours(0,0,0,0)),
      day_end: new Date(new Date(r.date).setHours(23,59,59,999))
    }))

  const vesselTransactions = allData.transactions
    .filter(t => t.suspected_vessels?.includes(vesselId) && locations.includes(t.target))
    .map(t => {
      const cId = allData.documentsMap[t.source]?.commodity || 'unknown'
      return {
        ...t,
        date: new Date(t.date),
        commodityId: cId,
        commodityName: allData.commodityNames[cId] || 'Unknown Commodity'
      }
    })

  // --- SVG Root Setup ---
  const svg = d3.select(plotContainer.value).append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
  
  const gMain = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // --- Definitions (Patterns & Clips) ---
  const defs = svg.append('defs')

  locations.forEach((loc, i) => {
    const p = defs.append('pattern')
      .attr('id', `stripe-${i}`)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternTransform', 'rotate(45)')
    p.append('rect')
      .attr('width', 4)
      .attr('height', 8)
      .attr('fill', getZoneFill(allData.locationKindMap[loc]))
      .attr('opacity', 0.4)
  })

  defs.append('clipPath')
    .attr('id', 'plot-area-clip')
    .append('rect')
    .attr('width', width)
    .attr('height', height)

  // --- Scales & Axes ---
  x = d3.scaleTime()
    .domain(d3.extent([
      ...vesselData.map(d => d.time), 
      ...vesselData.map(d => d.end_time), 
      highlightDate
    ]))
    .range([0, width])

  y = d3.scaleBand()
    .domain(locations)
    .range([0, height])
    .padding(0.3)

  const xAxisG = gMain.append('g')
    .attr('transform', `translate(0,${height})`)
    .attr('class', 'x-axis')
    .attr('color', 'var(--chart-axis-line)')
    .call(d3.axisBottom(x))
  
  const yAxisG = gMain.append('g')
    .call(d3.axisLeft(y).tickSize(0))
    .attr('class', 'y-axis');

  yAxisG.select(".domain").remove();

  yAxisG.call(drawRichYAxis);

  const gGrid = gMain.append('g').attr('class', 'grid-layer');

  const gridAxisX = d3.axisBottom(x)
      .tickSize(height)
      .tickFormat('')
      .ticks(10);

  const gGridHorizontal = gGrid.append('g').attr('class', 'grid-horizontal');

  gGridHorizontal.selectAll('line')
      .data(locations)
      .enter().append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => y(d) + y.bandwidth()) 
      .attr('y2', d => y(d) + y.bandwidth())
      .attr('stroke', 'var(--chart-grid-line)')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 1)
      .attr('opacity', 0.5);

  const gChart = gMain.append('g')
    .attr('clip-path', 'url(#plot-area-clip)')

  // --- Layer Groups ---
  dwellGroup = gChart.append('g').style('opacity', layers.pings ? 1 : 0)
  reportGroup = gChart.append('g').style('opacity', layers.reports ? 1 : 0)
  cargoGroup = gChart.append('g').style('opacity', layers.cargo ? 1 : 0)

  // --- Layer 1: Dwell Bars ---
  const dwellBars = dwellGroup.selectAll('.dwell')
    .data(vesselData).enter().append('rect')
    .attr('x', d => x(d.time))
    .attr('y', d => y(d.source))
    .attr('width', d => x(d.end_time) - x(d.time))
    .attr('height', y.bandwidth())
    .attr('fill', d => getZoneFill(allData.locationKindMap[d.source]))
    .attr('opacity', 0.8)
    .attr('rx', 1)
    .style('cursor', 'help')
    .on('mouseenter', (e, d) => showTooltip(e, {
      'Location': d.source, 
      'Arrived': d.time.toLocaleDateString(), 
      'Departed': d.end_time.toLocaleDateString()
    }, tooltip))
    .on('mouseleave', hideTooltip(tooltip))

  // --- Layer 2: Striped Report Bars ---
  const reportBars = reportGroup.selectAll('.report')
    .data(vesselReports).enter().append('rect')
    .attr('x', r => x(r.day_start))
    .attr('y', r => y(r.target))
    .attr('width', r => x(r.day_end) - x(r.day_start))
    .attr('height', y.bandwidth())
    .attr('fill', r => `url(#stripe-${locations.indexOf(r.target)})`)
    .attr('rx', 1)
    .style('cursor', 'help')
    .on('mouseenter', (e, r) => showTooltip(e, {
      'Report Filed': r.target, 
      'Date': r.day_start.toLocaleDateString()
    }, tooltip))
    .on('mouseleave', hideTooltip(tooltip))

  // --- Layer 3: Transaction Icons ---
  const transIcons = cargoGroup.selectAll('.icon')
    .data(vesselTransactions).enter().append('image')
    .attr('class', 'icon')
    .attr('x', t => x(t.date) - 12)
    .attr('y', t => y(t.target) + y.bandwidth()/2 - 12)
    .attr('width', 24)
    .attr('height', 24)
    .attr('href', t => `/src/assets/${fishIcons[t.commodityId] || fishIcons['default']}`)
    .style('cursor', 'help')
    .on('mouseenter', (e, t) => {
      const isIllegal = illegalCommodities.has(t.commodityId)
      showTooltip(e, {
        'Transaction': t.target, 
        'Commodity': t.commodityName, 
        'Status': isIllegal ? 'Illegal Shipment' : 'Legal Shipment',
        'Date': t.date.toLocaleDateString()
      }, tooltip, isIllegal ? 'danger' : 'default')
    })
    .on('mouseleave', hideTooltip(tooltip))

  // --- Layer 4: Market Exclusion Event ---
  highZoneGroup = gChart.append('g')
    .attr('class', 'exclusion-zone')
    .style('opacity', layers.event ? 1 : 0)
    .style('display', layers.event ? null : 'none')

  const exclusionStart = new Date(highlightDate)
  exclusionStart.setHours(0,0,0,0)
  const exclusionEnd = new Date(highlightDate)
  exclusionEnd.setHours(23,59,59,999)

  const exclusionRect = highZoneGroup.append('rect')
    .attr('x', x(exclusionStart))
    .attr('y', 0)
    .attr('width', x(exclusionEnd) - x(exclusionStart))
    .attr('height', height)
    .attr('fill', '#ef4444')
    .attr('opacity', 0.15)

  const bLeft = highZoneGroup.append('line')
    .attr('x1', x(exclusionStart)).attr('x2', x(exclusionStart))
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '6,4')

  const bRight = highZoneGroup.append('line')
    .attr('x1', x(exclusionEnd)).attr('x2', x(exclusionEnd))
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '6,4')

  highZoneGroup
    .style('cursor', 'help')
    .on('mouseenter', (e) => showTooltip(e, {
      'CRITICAL EVENT': 'SouthSeafood Express Corp was banned from fishing markets on this date.', 
      'Date': highlightDate.toLocaleDateString()
    }, tooltip, 'danger'))
    .on('mouseleave', hideTooltip(tooltip))

  // --- Interaction: Zoom & Pan ---
  const zoom = d3.zoom().scaleExtent([1, 100]).on('zoom', (event) => {
    currentTransform.value = event.transform
    hideTooltip(tooltip)
    const newX = event.transform.rescaleX(x)
    
    // Update Axis
    xAxisG.call(d3.axisBottom(newX))

    // Update Zone
    exclusionRect.attr('x', newX(exclusionStart)).attr('width', newX(exclusionEnd) - newX(exclusionStart))
    bLeft.attr('x1', newX(exclusionStart)).attr('x2', newX(exclusionStart))
    bRight.attr('x1', newX(exclusionEnd)).attr('x2', newX(exclusionEnd))

    // Update Data Elements
    dwellBars.attr('x', d => newX(d.time)).attr('width', d => newX(d.end_time) - newX(d.time))
    reportBars.attr('x', r => newX(r.day_start)).attr('width', r => newX(r.day_end) - newX(r.day_start))
    transIcons.attr('x', t => newX(t.date) - 12)
  })
  
  svg.call(zoom)
}



// --- Lifecycle ---
onMounted(() => { 
  initializeData()
  window.addEventListener('resize', renderChart) 
})

onUnmounted(() => window.removeEventListener('resize', renderChart))

// --- Watchers ---
watch(() => props.selectedVesselId, renderChart)

watch(layers, () => {
  toggleLayer(dwellGroup, layers.pings)
  toggleLayer(reportGroup, layers.reports)
  toggleLayer(cargoGroup, layers.cargo)
  toggleLayer(highZoneGroup, layers.event)
})
</script>

<template>
  <div class="relative w-full h-full flex flex-col overflow-hidden">
    
    <LoadingOverlay :loading="isLoading" message="Loading Visualization..." />

    <div ref="plotContainer" class="w-full min-h-0 flex-grow bg-white"></div>
    <Tooltip v-bind="tooltip" />

    <div class="h-8 shrink-0 border-t border-slate-100 flex items-center justify-end px-4 gap-2 bg-white">
       <span class="text-[9px] font-bold text-slate-300 uppercase mr-2 tracking-widest">Layers</span>
       
       <button @click="layers.pings = !layers.pings" class="layer-btn" :class="layers.pings ? 'text-blue-600 bg-blue-50 border-blue-100' : 'off'">
         <span class="dot bg-blue-500"></span> Pings
       </button>
       
       <button @click="layers.reports = !layers.reports" class="layer-btn" :class="layers.reports ? 'text-slate-600 bg-slate-100 border-slate-200' : 'off'">
         <span class="dot bg-slate-400"></span> Reports
       </button>
       
       <button @click="layers.cargo = !layers.cargo" class="layer-btn" :class="layers.cargo ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'off'">
         <span class="dot bg-emerald-500"></span> Cargo
       </button>
       
       <button @click="layers.event = !layers.event" class="layer-btn" :class="layers.event ? 'text-red-600 bg-red-50 border-red-100' : 'off'">
         <span class="dot bg-red-500"></span> Event
       </button>
    </div>
  </div>
</template>

<style scoped>
:deep(svg) { display: block; user-select: none; }

.layer-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}
.layer-btn:hover { background-color: #f8fafc; }
.layer-btn.off { background-color: transparent; color: #cbd5e1; border-color: transparent; }
.layer-btn.off .dot { background-color: #cbd5e1; }
.dot { width: 6px; height: 6px; border-radius: 50%; }
</style>