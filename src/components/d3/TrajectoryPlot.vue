<script setup>
import * as d3 from 'd3'
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { loadDocumentsMap, fishIcons, illegalCommodities, illegalFishingZones } from './utils.js'
import Tooltip from '../Tooltip.vue'

// --- Props & Refs ---
const props = defineProps({ selectedVesselId: String })
const plotContainer = ref(null)

// --- Chart Configuration & Globals ---
const margin = { top: 40, right: 40, bottom: 30, left: 120 }
const highlightDate = new Date('2035-05-14')
const currentTransform = ref(d3.zoomIdentity)

// --- Reactive Layer Visibility State ---
const isZoneVisible = ref(true)
const showPings = ref(true)
const showReports = ref(true)
const showCargo = ref(true)

// --- D3 Selections & Data Storage ---
let dwellGroup, reportGroup, cargoGroup, highZoneGroup, leaderLine
let x, y 
let allData = { 
  trajectories: null, 
  harborReports: null, 
  transactions: null, 
  documentsMap: null,
  commodityNames: {} 
}

// --- Tooltip State ---
const tooltip = reactive({
  x: 0, 
  y: 0, 
  contentDict: null, 
  visible: false, 
  variant: 'default'
})

// Toggle Layer Visibility: Animates the opacity of SVG groups based on reactive state
function toggleLayer(group, visible) {
  if (!group) return
  group.transition()
    .duration(300)
    .style('opacity', visible ? 1 : 0)
    .on('end', function() {
      d3.select(this).style('display', visible ? 'inline' : 'none')
    })
}

// Initial Data Fetch: Loads all required JSON datasets and maps commodity IDs to names
async function initializeData() {
  try {
    const [traj, reports, trans, docMap, commList] = await Promise.all([
      fetch('/data/trajectories.json').then(res => res.json()),
      fetch('/data/harbor_reports.json').then(res => res.json()),
      fetch('/data/transactions.json').then(res => res.json()),
      loadDocumentsMap(),
      fetch('/data/commodities.json').then(res => res.json())
    ])

    // Map commodity list to a lookup object for O(1) access
    const commLookup = {}
    commList.forEach(c => { commLookup[c.id] = c.name })

    allData = { 
      trajectories: traj, 
      harborReports: reports, 
      transactions: trans, 
      documentsMap: docMap,
      commodityNames: commLookup
    }
    renderChart()
  } catch (err) { 
    console.error("Data load error:", err) 
  }
}

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

  const locations = Array.from(new Set(vesselData.map(d => d.source)))
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(locations)

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
      .attr('fill', colorScale(loc))
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
    .call(d3.axisBottom(x))
  
  // Custom Y-Axis with Illegal Zone Highlighting
  const yAxisG = gMain.append('g')
    .call(d3.axisLeft(y).tickSize(0)) // Hide tick lines for a cleaner look
    .attr('class', 'y-axis');

  // Remove the vertical axis line (the "domain")
  yAxisG.select(".domain").remove();

  // Highlight Illegal Zones by changing text color
  yAxisG.selectAll(".tick text")
    .attr('fill', d => illegalFishingZones.has(d) ? '#ef4444' : '#374151') // Red if illegal, Gray if safe
    .style('font-weight', d => illegalFishingZones.has(d) ? 'bold' : '400')
    .style('font-size', '11px');

  // Tooltip Leash Line
  leaderLine = gMain.append('line')
    .attr('stroke', '#999')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,2')
    .style('opacity', 0)
    .style('pointer-events', 'none')

  const gChart = gMain.append('g')
    .attr('clip-path', 'url(#plot-area-clip)')

  // --- Layer Groups ---
  dwellGroup = gChart.append('g').style('opacity', showPings.value ? 1 : 0)
  reportGroup = gChart.append('g').style('opacity', showReports.value ? 1 : 0)
  cargoGroup = gChart.append('g').style('opacity', showCargo.value ? 1 : 0)

  // --- Layer 1: Dwell Bars ---
  const dwellBars = dwellGroup.selectAll('.dwell')
    .data(vesselData).enter().append('rect')
    .attr('x', d => x(d.time))
    .attr('y', d => y(d.source))
    .attr('width', d => x(d.end_time) - x(d.time))
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.source))
    .attr('opacity', 0.8)
    .style('cursor', 'help')
    .on('mouseenter', (e, d) => showTooltip({
      'Location': d.source, 
      'Arrived': d.time.toLocaleDateString(), 
      'Departed': d.end_time.toLocaleDateString()
    }, { date: d.end_time, location: d.source }))
    .on('mouseleave', hideTooltip)

  // --- Layer 2: Striped Report Bars ---
  const reportBars = reportGroup.selectAll('.report')
    .data(vesselReports).enter().append('rect')
    .attr('x', r => x(r.day_start))
    .attr('y', r => y(r.target))
    .attr('width', r => x(r.day_end) - x(r.day_start))
    .attr('height', y.bandwidth())
    .attr('fill', r => `url(#stripe-${locations.indexOf(r.target)})`)
    .style('cursor', 'help')
    .on('mouseenter', (e, r) => showTooltip({
      'Report Filed': r.target, 
      'Date': r.day_start.toLocaleDateString()
    }, { date: r.day_end, location: r.target }))
    .on('mouseleave', hideTooltip)

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
      showTooltip({
        'Transaction': t.target, 
        'Commodity': t.commodityName, 
        'Status': isIllegal ? '⚠️ ILLEGAL SHIPMENT' : 'Legal Shipment',
        'Date': t.date.toLocaleDateString()
      }, { date: t.date, location: t.target, isIcon: true }, isIllegal ? 'danger' : 'default')
    })
    .on('mouseleave', hideTooltip)

  // --- Layer 4: Market Exclusion Event ---
  highZoneGroup = gChart.append('g')
    .attr('class', 'exclusion-zone')
    .style('opacity', isZoneVisible.value ? 1 : 0)
    .style('display', isZoneVisible.value ? 'inline' : 'none');

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
    .on('mouseenter', () => showTooltip({
      'CRITICAL EVENT': 'SouthSeafood Express Corp was banned from fishing markets on this date.', 
      'Date': highlightDate.toLocaleDateString()
    }, { date: exclusionEnd, isHighLine: true }, 'danger'))
    .on('mouseleave', hideTooltip)

  // --- Interaction: Zoom & Pan ---
  const zoom = d3.zoom().scaleExtent([1, 100]).on('zoom', (event) => {
    currentTransform.value = event.transform
    hideTooltip()
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

// Tooltip Helper: Calculates screen coordinates and prepares content for the Tooltip component
function showTooltip(dict, rawAnchor, variant = 'default') {
  if (!plotContainer.value || !rawAnchor || !x || !y) return
  
  const svgRect = plotContainer.value.getBoundingClientRect()
  const liveX = currentTransform.value.applyX(x(rawAnchor.date))
  let liveY = rawAnchor.isHighLine 
    ? (plotContainer.value.clientHeight - margin.top - margin.bottom) / 2 
    : y(rawAnchor.location) + (rawAnchor.isIcon ? y.bandwidth()/2 : y.bandwidth())
  
  tooltip.x = svgRect.left + margin.left + liveX + 40
  tooltip.y = svgRect.top + margin.top + liveY + 20
  tooltip.contentDict = dict
  tooltip.variant = variant
  tooltip.visible = true
  
  if (leaderLine) {
    leaderLine
      .attr('x1', liveX)
      .attr('y1', liveY)
      .attr('x2', liveX + 40)
      .attr('y2', liveY + 20)
      .attr('stroke', variant === 'danger' ? 'red' : '#999')
      .style('opacity', 1)
  }
}

function hideTooltip() { 
  tooltip.visible = false
  if (leaderLine) leaderLine.style('opacity', 0) 
}

// --- Lifecycle ---
onMounted(() => { 
  initializeData()
  window.addEventListener('resize', renderChart) 
})

onUnmounted(() => window.removeEventListener('resize', renderChart))

// --- Watchers ---
watch(() => props.selectedVesselId, renderChart)
watch(isZoneVisible, (val) => toggleLayer(highZoneGroup, val))
watch(showPings, (val) => toggleLayer(dwellGroup, val))
watch(showReports, (val) => toggleLayer(reportGroup, val))
watch(showCargo, (val) => toggleLayer(cargoGroup, val))
</script>

<template>
  <div class="relative w-full h-full min-h-0 flex flex-col overflow-hidden">
    <div 
      v-if="!selectedVesselId" 
      class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50/80 z-10"
    >
      Please select a vessel to view its timeline
    </div>

    <div class="absolute top-2 right-2 z-20 flex gap-2">
      <button v-for="btn in [
        { state: showPings, label: 'Transponder Pings', color: 'blue' },
        { state: showReports, label: 'Harbor Reports', color: 'amber' },
        { state: showCargo, label: 'Probable Cargo', color: 'emerald' },
        { state: isZoneVisible, label: 'Exclusion Event', color: 'red' }
      ]" 
      :key="btn.label"
      @click="btn.label.includes('Pings') ? showPings = !showPings : btn.label.includes('Reports') ? showReports = !showReports : btn.label.includes('Cargo') ? showCargo = !showCargo : isZoneVisible = !isZoneVisible"
      :disabled="!selectedVesselId"
      class="px-2 py-1 text-[10px] font-bold uppercase rounded border transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        selectedVesselId && btn.state ? `bg-${btn.color}-50 text-${btn.color}-700 border-${btn.color}-200` : 'bg-white text-gray-400 border-gray-200',
        selectedVesselId ? `hover:bg-${btn.color}-100/50` : ''
      ]">
        {{ btn.state ? 'Hide' : 'Show' }} {{ btn.label }}
      </button>
    </div>
    
    <div ref="plotContainer" class="w-full h-full flex-grow bg-white"></div>
    
    <Tooltip v-bind="tooltip" />
  </div>
</template>

<style scoped>
:deep(svg) {
  display: block;
  user-select: none;
}
</style>