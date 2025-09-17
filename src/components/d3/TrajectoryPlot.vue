<template>
  <div ref="plotContainer" class="w-full h-96 bg-white rounded shadow"></div>
  <Tooltip v-bind="tooltip" />
</template>

<script setup>
import * as d3 from 'd3'
import { ref, reactive, onMounted, watch } from 'vue'
import { loadDocumentsMap, fishIcons } from './utils.js'
import Tooltip from '../Tooltip.vue'

function getColorPalette(n) {
  const d3scheme = d3.schemeTableau10 || d3.schemeCategory10
  if (n <= d3scheme.length) return d3scheme.slice(0, n)
  return Array.from({ length: n }, (_, i) => d3.interpolateRainbow(i / n))
}

const plotContainer = ref(null)
const props = defineProps({ selectedVesselId: String })

const margin = { top: 30, right: 30, bottom: 80, left: 120 }
const highlightDate = '2035-05-14'

// Tooltip reactive state
const tooltip = reactive({
  x: 0,
  y: 0,
  content: '',
  contentDict: null,
  visible: false
})

// Funzioni tooltip
function showTooltip(event, dict) {
  tooltip.x = event.clientX + 8
  tooltip.y = event.clientY + 8
  tooltip.content = ''
  tooltip.contentDict = dict
  tooltip.visible = true
}

function hideTooltip() {
  tooltip.visible = false
  tooltip.contentDict = null
}

async function renderChart() {
  if (!props.selectedVesselId) return

  // Load data
  const [trajRes, reportsRes, transRes, documentsMap] = await Promise.all([
    fetch('/data/trajectories.json'),
    fetch('/data/harbor_reports.json'),
    fetch('/data/transactions.json'),
    loadDocumentsMap()
  ])
  const trajectories = await trajRes.json()
  const harborReports = await reportsRes.json()
  const transactions = await transRes.json()

  const vesselId = props.selectedVesselId
  const vesselData = trajectories[vesselId]
  const locations = Array.from(new Set(vesselData.map(d => d.source)))

  // Color palette
  const palette = getColorPalette(locations.length)
  const locationColors = {}
  locations.forEach((loc, i) => locationColors[loc] = palette[i])

  // Process vessel data
  vesselData.forEach(d => {
    d.time = new Date(d.time)
    d.end_time = new Date(d.time.getTime() + Number(d.dwell) * 1000)
  })

  const vesselReports = harborReports
    .filter(r => r.source === vesselId && locations.includes(r.target))
    .map(r => {
      const date = new Date(r.date)
      const day_start = new Date(date); day_start.setHours(0,0,0,0)
      const day_end = new Date(day_start); day_end.setDate(day_end.getDate()+1)
      const day_mid = new Date(day_start); day_mid.setHours(12,0,0,0)
      return { ...r, date, day_start, day_end, day_mid }
    })

  const vesselTransactions = transactions
    .filter(t => Array.isArray(t.suspected_vessels) && t.suspected_vessels.includes(vesselId) && locations.includes(t.target))
    .map(t => {
      const date = new Date(t.date)
      const day_mid = new Date(date); day_mid.setHours(12,0,0,0)
      const doc = documentsMap[t.source] || {}
      return { ...t, date, day_mid, commodity: doc.commodity }
    })

  // Dimensions
  const containerWidth = plotContainer.value.clientWidth
  const containerHeight = plotContainer.value.clientHeight
  const width = containerWidth
  const plotHeight = containerHeight - margin.top - margin.bottom

  // SVG
  const svg = d3.select(plotContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', containerHeight)

  // Scales
  const xExtent = d3.extent([
    ...vesselData.map(d => d.time),
    ...vesselData.map(d => d.end_time),
    ...vesselReports.map(r => r.day_start),
    ...vesselReports.map(r => r.day_end),
    ...vesselTransactions.map(t => t.day_mid),
    new Date(highlightDate)
  ])
  const x = d3.scaleTime().domain(xExtent).range([0, width - margin.left - margin.right])
  const y = d3.scaleBand().domain(locations).range([0, plotHeight]).padding(0.2)

  // Main group centered vertically
  const yOffset = (containerHeight - plotHeight) / 2
  const gMain = svg.append('g').attr('transform', `translate(${margin.left},${yOffset})`)

  // Axes
  const xAxis = gMain.append('g')
    .attr('transform', `translate(0,${plotHeight})`)
    .call(d3.axisBottom(x))
  gMain.append('g').call(d3.axisLeft(y))

  // Clip path
  const defs = svg.append('defs')
  defs.append('clipPath')
    .attr('id','plot-clip')
    .append('rect')
    .attr('width', width - margin.left - margin.right)
    .attr('height', plotHeight)

  const gChart = gMain.append('g').attr('clip-path','url(#plot-clip)')

  // Dwell bars
  gChart.selectAll('.dwell-bar')
    .data(vesselData).enter()
    .append('rect')
    .attr('class','dwell-bar')
    .attr('x',d=>x(d.time))
    .attr('y',d=>y(d.source))
    .attr('width',d=>x(d.end_time)-x(d.time))
    .attr('height',y.bandwidth())
    .attr('fill',d=>locationColors[d.source])
    .attr('opacity',0.85)
    .on('mouseover',(event,d)=>{
      showTooltip(event, {
        'Location': d.source,
        'Start': d.time.toLocaleString(),
        'End': d.end_time.toLocaleString()
      })
    })
    .on('mouseout', hideTooltip)

  // Reports
  gChart.selectAll('.report-bar')
    .data(vesselReports).enter()
    .append('rect')
    .attr('class','report-bar')
    .attr('x',r=>x(r.day_start))
    .attr('y',r=>y(r.target))
    .attr('width',r=>x(r.day_end)-x(r.day_start))
    .attr('height',y.bandwidth())
    .attr('fill',r=>`url(#lightstripe-${locations.indexOf(r.target)})`)
    .attr('opacity',0.7)
    .on('mouseover',(event,r)=>{
      showTooltip(event, {
        'Report at': r.target,
        'Date': r.date.toLocaleDateString()
      })
    })
    .on('mouseout', hideTooltip)

  // Transaction markers
  gChart.selectAll('.trans-marker')
    .data(vesselTransactions).enter()
    .append('image')
    .attr('class','trans-marker')
    .attr('x',t=>x(t.day_mid)-16)
    .attr('y',t=>y(t.target)+y.bandwidth()/2-16)
    .attr('width',32).attr('height',32)
    .attr('href',t=>`/src/assets/${fishIcons[t.commodity]||fishIcons['default']}`)
    .on('mouseover',(event,t)=>{
      showTooltip(event, {
        'Transaction at': t.target,
        'Date': t.date.toLocaleDateString(),
        'Commodity': t.commodity || 'unknown'
      })
    })
    .on('mouseout', hideTooltip)

  // Highlight line
  gChart.append('line')
    .attr('x1',x(new Date(highlightDate)))
    .attr('x2',x(new Date(highlightDate)))
    .attr('y1',0)
    .attr('y2',plotHeight)
    .attr('stroke','red')
    .attr('stroke-width',2)
    .attr('opacity',0.7)

  // Title
  svg.append('text')
    .attr('x', width/2)
    .attr('y', yOffset/2)
    .attr('text-anchor','middle')
    .attr('font-size',12)
    .text(vesselId)

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([1,50])
    .translateExtent([[0,0],[width - margin.left - margin.right, plotHeight]])
    .extent([[0,0],[width - margin.left - margin.right, plotHeight]])
    .on('zoom', event => {
      const newX = event.transform.rescaleX(x)
      xAxis.call(d3.axisBottom(newX))
      gChart.selectAll('.dwell-bar').attr('x',d=>newX(d.time)).attr('width',d=>newX(d.end_time)-newX(d.time))
      gChart.selectAll('.report-bar').attr('x',r=>newX(r.day_start)).attr('width',r=>newX(r.day_end)-newX(r.day_start))
      gChart.selectAll('.trans-marker').attr('x',t=>newX(t.day_mid)-16)
      gChart.select('line').attr('x1',newX(new Date(highlightDate))).attr('x2',newX(new Date(highlightDate)))
    })

  svg.call(zoom)
}

onMounted(() => renderChart())

watch(() => props.selectedVesselId, (newId) => {
  if (!newId) return
  d3.select(plotContainer.value).selectAll('*').remove()
  renderChart()
})
</script>

<style scoped>
.bg-white { background: var(--main-white); }
</style>
