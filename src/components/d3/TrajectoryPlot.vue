<template>
  <div ref="plotContainer" class="w-full h-64 bg-white rounded shadow"></div>
</template>

<script setup>
import * as d3 from 'd3'
import { ref, onMounted } from 'vue'
const plotContainer = ref(null)

// Configuration
const width = 950
const height = 300
const margin = { top: 30, right: 30, bottom: 40, left: 120 }
const highlightDate = '2035-05-14' // data da evidenziare

onMounted(async () => {
  // Load data
  const [trajRes, reportsRes, transRes] = await Promise.all([
    fetch('/data/trajectories.json'),
    fetch('/data/harbor_reports.json'),
    fetch('/data/transactions.json')
  ])
  const trajectories = await trajRes.json()
  const harborReports = await reportsRes.json()
  const transactions = await transRes.json()

  // Select a vessel id to visualize (example: first available)
  const vesselId = Object.keys(trajectories)[0]
  const vesselData = trajectories[vesselId]

  // Find all locations (ordinates)
  const locations = Array.from(new Set(vesselData.map(d => d.source)))
  const locationToY = Object.fromEntries(locations.map((loc, i) => [loc, i]))

  // Prepare dwell bar data
  vesselData.forEach(d => {
    d.time = new Date(d.time)
    d.end_time = new Date(new Date(d.time).getTime() + (Number(d.dwell) * 1000))
  })

  // Prepare port report data (only for this vessel)
  const vesselReports = harborReports.filter(r => r.source === vesselId && locations.includes(r.target))
  vesselReports.forEach(r => {
    r.date = new Date(r.date)
    r.day_start = new Date(r.date)
    r.day_start.setHours(0,0,0,0)
    r.day_end = new Date(r.day_start)
    r.day_end.setDate(r.day_end.getDate() + 1)
    r.day_mid = new Date(r.day_start)
    r.day_mid.setHours(12,0,0,0)
  })

  // Prepare transaction data (only for this vessel)
  const vesselTransactions = transactions.filter(t => Array.isArray(t.suspected_vessels) && t.suspected_vessels.includes(vesselId) && locations.includes(t.target))
  vesselTransactions.forEach(t => {
    t.date = new Date(t.date)
    t.day_mid = new Date(t.date)
    t.day_mid.setHours(12,0,0,0)
  })

  // SVG
  const svg = d3.select(plotContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  // Scale
  const xExtent = d3.extent([
    ...vesselData.map(d => d.time),
    ...vesselData.map(d => d.end_time),
    ...vesselReports.map(r => r.day_start),
    ...vesselReports.map(r => r.day_end),
    ...vesselTransactions.map(t => t.day_mid),
    new Date(highlightDate)
  ])
  const x = d3.scaleTime()
    .domain(xExtent)
    .range([margin.left, width - margin.right])
  const y = d3.scaleBand()
    .domain(locations)
    .range([margin.top, height - margin.bottom])
    .padding(0.2)

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))

  // Dwell bars (steelblue)
  svg.selectAll('.dwell-bar')
    .data(vesselData)
    .enter()
    .append('rect')
    .attr('class', 'dwell-bar')
    .attr('x', d => x(d.time))
    .attr('y', d => y(d.source))
    .attr('width', d => x(d.end_time) - x(d.time))
    .attr('height', y.bandwidth())
    .attr('fill', '#4682b4')
    .attr('opacity', 0.85)

  // Overlay port report
  svg.selectAll('.report-bar')
    .data(vesselReports)
    .enter()
    .append('rect')
    .attr('class', 'report-bar')
    .attr('x', r => x(r.day_start))
    .attr('y', r => y(r.target))
    .attr('width', r => x(r.day_end) - x(r.day_start))
    .attr('height', y.bandwidth())
    .attr('fill', 'red')
    .attr('opacity', 0.3)

  // Overlay port report
  svg.selectAll('.report-marker')
    .data(vesselReports)
    .enter()
    .append('circle')
    .attr('class', 'report-marker')
    .attr('cx', r => x(r.day_mid))
    .attr('cy', r => y(r.target) + y.bandwidth()/2)
    .attr('r', 10)
    .attr('fill', 'red')
    .attr('opacity', 0.6)

  // Overlay transaction marker
  svg.selectAll('.trans-marker')
    .data(vesselTransactions)
    .enter()
    .append('rect')
    .attr('class', 'trans-marker')
    .attr('x', t => x(t.day_mid) - 8)
    .attr('y', t => y(t.target) + y.bandwidth()/2 - 8)
    .attr('width', 16)
    .attr('height', 16)
    .attr('fill', 'blue')
    .attr('opacity', 0.6)

  // Vertical line to highlight specific date
  svg.append('line')
    .attr('x1', x(new Date(highlightDate)))
    .attr('x2', x(new Date(highlightDate)))
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .attr('stroke', 'red')
    .attr('stroke-width', 2)
    .attr('opacity', 0.7)

  // Title
  svg.append('text')
    .attr('x', width/2)
    .attr('y', margin.top/2)
    .attr('text-anchor', 'middle')
    .attr('font-size', 20)
    .attr('font-weight', 'bold')
    .text('Vessel Route Over Time: ' + vesselId)
})
</script>

<style scoped>
.bg-white {
  background: var(--main-white);
}
</style>
