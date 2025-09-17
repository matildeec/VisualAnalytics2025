<template>
  <div ref="plotContainer" class="w-full h-96 bg-white rounded shadow overflow-x-auto"></div>
</template>

<script setup>
import { loadDocumentsMap } from './documentsUtil.js';
// Funzione per generare una palette di colori distinte
function getColorPalette(n) {
  const d3scheme = d3.schemeTableau10 || d3.schemeCategory10;
  if (n <= d3scheme.length) return d3scheme.slice(0, n);
  // Se servono più colori, genera con interpolateRainbow
  return Array.from({length: n}, (_, i) => d3.interpolateRainbow(i / n));
}
// Mappa commodity -> nome file SVG (coerente con commodities.json)
const fishIcons = {
  'gadusnspecificatae4ba': 'fish-icon-1.svg',
  'piscesfrigus900': 'fish-icon-2.svg',
  'piscesfoetidaae7': 'fish-icon-3.svg',
  'labridaenrefert9be': 'fish-icon-4.svg',
  'habeaspisces4eb': 'fish-icon-5.svg',
  'piscissapidum9b7': 'fish-icon-6.svg',
  'thunnininveradb7': 'fish-icon-7.svg',
  'piscisosseusb6d': 'fish-icon-8.svg',
  'oncorhynchusrosea790': 'fish-icon-9.svg',
  'piscessatisb87': 'fish-icon-10.svg',
  // fallback
  'default': 'fish-icon-default.svg'
}

import * as d3 from 'd3'
import { ref, onMounted } from 'vue'

const plotContainer = ref(null)

const brushHeight = 40
const margin = { top: 30, right: 30, bottom: 100, left: 120 }
const highlightDate = '2035-05-14'

onMounted(async () => {


  // ================================
  // Load and prepare data
  // ================================
  const [trajRes, reportsRes, transRes, documentsMap] = await Promise.all([
    fetch('/data/trajectories.json'),
    fetch('/data/harbor_reports.json'),
    fetch('/data/transactions.json'),
    loadDocumentsMap()
  ])
  const trajectories = await trajRes.json()
  const harborReports = await reportsRes.json()
  const transactions = await transRes.json()

  const vesselId = Object.keys(trajectories)[0]
  const vesselData = trajectories[vesselId]

  const locations = Array.from(new Set(vesselData.map(d => d.source)))

  // Crea una mappa colore per le locations
  const locationColors = {};
  const palette = getColorPalette(locations.length);
  locations.forEach((loc, i) => { locationColors[loc] = palette[i]; });

  // Prepare data
  vesselData.forEach(d => {
    d.time = new Date(d.time)
    d.end_time = new Date(d.time.getTime() + Number(d.dwell) * 1000)
  })

  const vesselReports = harborReports
    .filter(r => r.source === vesselId && locations.includes(r.target))
    .map(r => {
      const date = new Date(r.date)
      const day_start = new Date(date); day_start.setHours(0, 0, 0, 0)
      const day_end = new Date(day_start); day_end.setDate(day_end.getDate() + 1)
      const day_mid = new Date(day_start); day_mid.setHours(12, 0, 0, 0)
      return { ...r, date, day_start, day_end, day_mid }
    })

  // Merge transactions con documents per ottenere la commodity
  const vesselTransactions = transactions
    .filter(t => Array.isArray(t.suspected_vessels) && t.suspected_vessels.includes(vesselId) && locations.includes(t.target))
    .map(t => {
      const date = new Date(t.date)
      const day_mid = new Date(date); day_mid.setHours(12, 0, 0, 0)
      // t.source è l'id del documento
      const doc = documentsMap[t.source] || {};
      return { ...t, date, day_mid, commodity: doc.commodity };
    })

  // ================================
  // Set up SVG and scales
  // ================================
  // Get actual width and height of the div
  const containerWidth = plotContainer.value.clientWidth
  const containerHeight = plotContainer.value.clientHeight

  console.log('Container dimensions:', containerWidth, containerHeight)

  // Get dimensions for SVG
  const width = Math.max(containerWidth, 800)
  const plotHeight = Math.max(containerHeight - brushHeight, 320)
  const totalHeight = plotHeight + brushHeight + margin.top + margin.bottom

  // SVG container
  const svg = d3.select(plotContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', totalHeight)

  // Definisci un clipPath per l'area interna del grafico
  const defs = svg.append('defs');

  // Pattern vettoriale a righe colorate per ogni location
  locations.forEach((loc, i) => {
    const pattern = defs.append('pattern')
      .attr('id', `lightstripe-${i}`)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 3)
      .attr('height', 3);
    pattern.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 3)
      .attr('height', 3)
      .attr('fill', locationColors[loc])
      .attr('opacity', 0.2);
    pattern.append('path')
      .attr('d', 'M0,0 l3,3')
      .attr('stroke', locationColors[loc])
      .attr('stroke-width', 1.2);
  });

  defs.append('clipPath')
    .attr('id', 'plot-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width - margin.left - margin.right)
    .attr('height', plotHeight - margin.top - margin.bottom);

  // Tooltip
  const tooltip = d3.select(plotContainer.value)
    .append('div')
    .style('position', 'absolute')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('padding', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0)

  // Scale
  const xExtent = d3.extent([
    ...vesselData.map(d => d.time),
    ...vesselData.map(d => d.end_time),
    ...vesselReports.map(r => r.day_start),
    ...vesselReports.map(r => r.day_end),
    ...vesselTransactions.map(t => t.day_mid),
    new Date(highlightDate)
  ])
  const x = d3.scaleTime().domain(xExtent).range([0, width - margin.left - margin.right])
  const y = d3.scaleBand().domain(locations).range([0, plotHeight - margin.top - margin.bottom]).padding(0.2)

  // Main group translated
  const gMain = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Axes
  const xAxis = gMain.append('g')
    .attr('transform', `translate(0,${plotHeight - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x))
  gMain.append('g')
    .call(d3.axisLeft(y))

  // This var will contain all the chart elements
  const gChart = gMain.append('g')
    .attr('clip-path', 'url(#plot-clip)')

  // =================================
  // Draw elements inside gChart
  // =================================
  // Dwell bars
  const dwellBars = gChart.selectAll('.dwell-bar')
    .data(vesselData)
    .enter().append('rect')
    .attr('class', 'dwell-bar')
    .attr('x', d => x(d.time))
    .attr('y', d => y(d.source))
    .attr('width', d => x(d.end_time) - x(d.time))
    .attr('height', y.bandwidth())
    .attr('fill', d => locationColors[d.source] || '#4682b4')
    .attr('opacity', 0.85)
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('opacity', 0.9)
      tooltip.html(`Location: ${d.source}<br>Start: ${d.time}<br>End: ${d.end_time}`)
        .style('left', (event.pageX + 5) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0))

  // Report bars con pattern alternati
  const reportBars = gChart.selectAll('.report-bar')
    .data(vesselReports)
    .enter().append('rect')
    .attr('class', 'report-bar')
    .attr('x', r => x(r.day_start))
    .attr('y', r => y(r.target))
    .attr('width', r => x(r.day_end) - x(r.day_start))
    .attr('height', y.bandwidth())
    .attr('fill', r => {
      const idx = locations.indexOf(r.target);
      return `url(#lightstripe-${idx})`;
    })
    .attr('opacity', 0.7)
    .on('mouseover', (event, r) => {
      tooltip.transition().duration(200).style('opacity', 0.9)
      tooltip.html(`Report at: ${r.target}<br>Date: ${r.date}`)
        .style('left', (event.pageX + 5) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0))

  // Transaction markers come SVG <image>
  const transMarkers = gChart.selectAll('.trans-marker')
    .data(vesselTransactions)
    .enter().append('image')
    .attr('class', 'trans-marker')
    .attr('x', t => x(t.day_mid) - 16)
    .attr('y', t => y(t.target) + y.bandwidth() / 2 - 16)
    .attr('width', 32)
    .attr('height', 32)
    .attr('href', t => `/src/assets/${fishIcons[t.commodity] || fishIcons['default']}`)
    .attr('opacity', 0.95)
    .on('mouseover', (event, t) => {
      tooltip.transition().duration(200).style('opacity', 0.9)
      tooltip.html(`Transaction at: ${t.target}<br>Date: ${t.date}<br>Commodity: ${t.commodity || 'unknown'}`)
        .style('left', (event.pageX + 5) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0));

  // Highlight line
  const highlightLine = gChart.append('line')
    .attr('x1', x(new Date(highlightDate)))
    .attr('x2', x(new Date(highlightDate)))
    .attr('y1', 0)
    .attr('y2', plotHeight - margin.top - margin.bottom)
    .attr('stroke', 'red')
    .attr('stroke-width', 2)
    .attr('opacity', 0.7)

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top / 2)
    .attr('text-anchor', 'middle')
    .attr('font-size', 20)
    .attr('font-weight', 'bold')
    .text('Vessel Route Over Time: ' + vesselId)

  // ZOOM
  const zoom = d3.zoom()
    .scaleExtent([0, 50])
    .translateExtent([
      [0, 0],
      [width - margin.left - margin.right, plotHeight - margin.top - margin.bottom]
    ])
    .on('zoom', (event) => {
      const newX = event.transform.rescaleX(x)
      xAxis.call(d3.axisBottom(newX))
  dwellBars.attr('x', d => newX(d.time)).attr('width', d => newX(d.end_time) - newX(d.time))
  reportBars.attr('x', r => newX(r.day_start)).attr('width', r => newX(r.day_end) - newX(r.day_start))
  // Aggiorna posizione dei marker SVG (image)
  transMarkers.attr('x', t => newX(t.day_mid) - 16)
  highlightLine.attr('x1', newX(new Date(highlightDate))).attr('x2', newX(new Date(highlightDate)))
    })

  svg.call(zoom)

  // BRUSH
  const xBrush = d3.scaleTime().domain(x.domain()).range([margin.left, width - margin.right])
  svg.append('g')
    .attr('transform', `translate(0,${plotHeight - margin.bottom + 50})`)
    .call(d3.axisBottom(xBrush))

  const brush = d3.brushX()
    .extent([
      [margin.left, plotHeight - margin.bottom + 40],
      [width - margin.right, plotHeight - margin.bottom + 40 + brushHeight]
    ])
    .on('brush end', (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection.map(xBrush.invert)
        const newX = d3.scaleTime().domain([x0, x1]).range([margin.left, width - margin.right])
        xAxis.call(d3.axisBottom(newX))
        dwellBars.attr('x', d => newX(d.time)).attr('width', d => newX(d.end_time) - newX(d.time))
        reportBars.attr('x', r => newX(r.day_start)).attr('width', r => newX(r.day_end) - newX(r.day_start))
        transMarkers.attr('x', t => newX(t.day_mid) - 8)
        highlightLine.attr('x1', newX(new Date(highlightDate))).attr('x2', newX(new Date(highlightDate)))
      }
    })

  svg.append('g').call(brush)
})
</script>

<style scoped>
.bg-white {
  background: var(--main-white);
}
</style>
