<script setup>
import * as d3 from 'd3'
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getAssetPath, getCommodities, getLocations } from '../../dataManager.js'
import { fishIcons, getCommodityStatus, getZoneFill, getZoneBorder, showTooltip, hideTooltip } from './utils.js'
import Tooltip from '../Tooltip.vue'
import LoadingOverlay from '../LoadingOverlay.vue'

const props = defineProps({ 
  vesselData: Object
})

const isLoading = ref(true)
const tooltip = ref({ x: 0, y: 0, contentDict: {}, visible: false, variant: 'default' })

const chartContainer = ref(null)
const currentTransform = ref(d3.zoomIdentity)

const MARGIN = { top: 20, right: 40, bottom: 40, left: 120 }
const HIGHLIGHT_DATE = new Date('2035-05-14')

const ICON_SIZE = 24;
const ICON_SPACING = 10;

// Layer visibility states are reactive because we want to watch them for changes
const layers = reactive({
  pings: true,
  reports: true,
  cargo: true,
  event: true
})

// Groups defined outside renderChart for toggling visibility
let dwellGroup, reportGroup, cargoGroup, highZoneGroup

const contextData = {
  sortedLocations: [],
  locationKindMap: {},
  commodityNames: {}
}

// Toggles visibility of a given layer with a smooth transition
function toggleLayer(group, visible) {
  if (!group) return
  group.transition().duration(200).style('opacity', visible ? 1 : 0)
}

// Draw custom y axis with rich labels including location kind
const drawRichYAxis = (g) => {
  g.selectAll(".tick").each(function(d) {
    const tick = d3.select(this);
    
    tick.selectAll("text").remove(); 
    tick.selectAll(".rich-label").remove();

    const kind = contextData.locationKindMap[d] || 'Unknown';

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

const renderChart = async () => {
  isLoading.value = true

  if (!chartContainer.value || !props.vesselData || contextData.sortedLocations.length === 0) {
    isLoading.value = false;
    return;
  }
  
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 50));

  d3.select(chartContainer.value).selectAll('*').remove();

  try {

    // Responsive Dimensions
    const containerWidth = chartContainer.value.clientWidth
    const containerHeight = chartContainer.value.clientHeight
    const width = containerWidth - MARGIN.left - MARGIN.right
    const height = containerHeight - MARGIN.top - MARGIN.bottom

    // Data Preparation
    const { trajectory, reports, transactions } = props.vesselData
    const locations = contextData.sortedLocations

    // Helpers
    const getDayRange = (d) => [new Date(d.setHours(0,0,0,0)), new Date(d.setHours(23,59,59,999))]

    const vesselTrajectory = trajectory.map(t => ({
      ...t,
      time: new Date(t.time),
      end_time: new Date(new Date(t.time).getTime() + (Number(t.dwell) || 0) * 1000)
    }))

    const vesselReports = reports.map(r => {
      const [day_start, day_end] = getDayRange(new Date(r.date))
      return {
        ...r,
        day_start,
        day_end
      }
    })

    // Group transactions by (date, location)
    const groupedTransactionsMap = new Map();

    transactions.forEach(t => {
      // Same day and same location as key
      const key = `${new Date(t.date).toDateString()}-${t.target}`;
      
      if (!groupedTransactionsMap.has(key)) {
        groupedTransactionsMap.set(key, {
          date: new Date(t.date),
          target: t.target,
          items: [] // contains all transactions for this group
        });
      }
      
      // Add transaction to the appropriate group
      groupedTransactionsMap.get(key).items.push({
        ...t,
        commodityName: contextData.commodityNames[t.commodityId] || 'Unknown',
        status: getCommodityStatus(t.commodityId)
      });
    });

    // For each group, determine the main representative icon and sort items
    const groupedTransactions = Array.from(groupedTransactionsMap.values()).map(group => {
      
      // Sorting: first by status, then by quantity
      group.items.sort((a, b) => {
        const scoreA = (a.status === 'illegal' ? 100 : 0) + (a.status === 'suspect' ? 50 : 0);
        const scoreB = (b.status === 'illegal' ? 100 : 0) + (b.status === 'suspect' ? 50 : 0);
        if (scoreA !== scoreB) return scoreB - scoreA; // Status
        return (b.qty || 0) - (a.qty || 0); // Quantity
      });

      // The first item after sorting is the main representative icon
      group.mainItem = group.items[0];
      
      return group;
    });

    // SVG Setup
    const svg = d3.select(chartContainer.value).append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
    
    const gMain = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Defs for patterns and clip paths
    const defs = svg.append('defs')
    
    // Batch create patterns
    locations.forEach((loc, i) => {
      defs.append('pattern')
        .attr('id', `stripe-${i}`)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 8).attr('height', 8)
        .attr('patternTransform', 'rotate(45)')
        .append('rect')
        .attr('width', 4).attr('height', 8)
        .attr('fill', getZoneFill(contextData.locationKindMap[loc]))
        .attr('opacity', 0.4)
    })

    defs.append('clipPath')
      .attr('id', 'plot-area-clip')
      .append('rect').attr('width', width)
      .attr('height', height)

    // Scales to map data to screen coordinates
    const xScale = d3.scaleTime()
      .domain(d3.extent([...vesselTrajectory.map(d => d.time), ...vesselTrajectory.map(d => d.end_time), HIGHLIGHT_DATE]))
      .range([0, width])

    const yScale = d3.scaleBand()
      .domain(locations)
      .range([0, height])
      .padding(0.3)

    // X Axis
    const xAxisG = gMain.append('g')
      .attr('transform', `translate(0,${height})`)
      .attr('class', 'x-axis text-[var(--chart-axis-line)] text-[10px]')
      .call(d3.axisBottom(xScale))
    
    // Y Axis with rich labels
    const yAxisG = gMain.append('g').call(d3.axisLeft(yScale).tickSize(0)).attr('class', 'y-axis')
    yAxisG.select(".domain").remove()
    yAxisG.call(drawRichYAxis)

    // Grid System
    const gGrid = gMain.append('g').attr('class', 'grid-layer')
    
    // Horizontal Grid (Static)
    gGrid.append('g').attr('class', 'grid-horizontal').selectAll('line')
      .data(locations).enter().append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => yScale(d) + yScale.bandwidth())
      .attr('y2', d => yScale(d) + yScale.bandwidth())
      .attr('stroke', 'var(--chart-grid-line)').attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.5)

    // Vertical Grid (Dynamic Helper Function)
    const gGridVertical = gGrid.append('g').attr('class', 'grid-vertical')
    
    const updateVerticalGrid = (currentScale) => {
      const ticks = currentScale.ticks ? currentScale.ticks(8) : currentScale.domain()
      gGridVertical.selectAll('line')
        .data(ticks)
        .join(
          enter => enter.append('line')
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', 'var(--chart-grid-line)')
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.5),
          update => update,
          exit => exit.remove()
        )
        .attr('x1', d => currentScale(d))
        .attr('x2', d => currentScale(d))
    }
    
    // Initial Grid Draw
    updateVerticalGrid(xScale)

    // Draw Layers
    const gChart = gMain.append('g').attr('clip-path', 'url(#plot-area-clip)')
    
    dwellGroup = gChart.append('g').style('opacity', layers.pings ? 1 : 0)
    reportGroup = gChart.append('g').style('opacity', layers.reports ? 1 : 0)
    cargoGroup = gChart.append('g').style('opacity', layers.cargo ? 1 : 0)

    // Dwell Bars
    const dwellBars = dwellGroup.selectAll('.dwell')
      .data(vesselTrajectory).enter().append('rect')
      .attr('class', 'dwell')
      .attr('x', d => xScale(d.time))
      .attr('y', d => yScale(d.source))
      .attr('width', d => xScale(d.end_time) - xScale(d.time))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => getZoneFill(contextData.locationKindMap[d.source]))
      .attr('rx', 1).attr('opacity', 0.8)
      .on('mouseenter', (e, d) => showTooltip(e, {
        'Location': d.source, 'Arrived': d.time.toLocaleDateString(), 'Departed': d.end_time.toLocaleDateString()
      }, tooltip))
      .on('mouseleave', () => hideTooltip(tooltip))

    // Report Bars
    const reportBars = reportGroup.selectAll('.report')
      .data(vesselReports).enter().append('rect')
      .attr('class', 'report')
      .attr('x', r => xScale(r.day_start))
      .attr('y', r => yScale(r.target))
      .attr('width', r => xScale(r.day_end) - xScale(r.day_start))
      .attr('height', yScale.bandwidth())
      .attr('fill', r => `url(#stripe-${locations.indexOf(r.target)})`)
      .attr('rx', 1)
      .on('mouseenter', (e, r) => showTooltip(e, {
        'Report Filed': r.target, 'Date': r.day_start.toLocaleDateString()
      }, tooltip))
      .on('mouseleave', () => hideTooltip(tooltip))

    // Transaction Icons
    const iconGroups = cargoGroup.selectAll('.trans-group')
      .data(groupedTransactions)
      .join('g')
      .attr('class', 'trans-group')
      .attr('transform', d => `translate(${xScale(d.date) - 12}, ${yScale(d.target) + yScale.bandwidth()/2 - 12})`);

    // Icon Image
    iconGroups.append('image')
      .attr('width', 24).attr('height', 24)
      .attr('href', d => getAssetPath(fishIcons[d.mainItem.commodityId] || fishIcons['default']));

    // If more than one item, draw badge
    const badgeGroup = iconGroups.filter(d => d.items.length > 1)
      .append('g')
      .attr('transform', 'translate(18, -4)'); // In alto a destra dell'icona

    // Badge circle
    badgeGroup.append('circle')
      .attr('r', 7)
      .attr('fill', '#ef4444')
      .attr('stroke', 'white').attr('stroke-width', 1.5);

    // Badge number
    badgeGroup.append('text')
      .text(d => d.items.length)
      .attr('dy', 2.8) // Vertical centering
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', 'white');

    // Tooltip interactions
    iconGroups
      .on('mouseenter', (e, d) => {
        // Create content dictionary for tooltip
        const content = {
          'Location': d.target,
          'Date': d.date.toLocaleDateString()
        };

        // Add each cargo item as separate entry
        d.items.forEach((item, idx) => {
            const key = `Cargo #${idx + 1}`;
            const val = `${item.commodityName} ${item.status === 'illegal' ? '⚠️' : ''} (${item.qty || '?'}t)`;
            content[key] = val;
        });

        // Determines tooltip variant based on worst status
        const worstStatus = d.items.some(i => i.status === 'illegal') ? 'danger' :
                            d.items.some(i => i.status === 'suspect') ? 'warning' : 'default';

        showTooltip(e, content, tooltip, worstStatus);
      })
      .on('mouseleave', () => hideTooltip(tooltip));

    // Market Exclusion Zone
    highZoneGroup = gChart.append('g').attr('class', 'exclusion-zone')
      .style('opacity', layers.event ? 1 : 0)
      .style('display', layers.event ? null : 'none')
      .on('mouseenter', (e) => showTooltip(e, {
        'CRITICAL EVENT': 'SouthSeafood Express Corp banned.', 'Date': HIGHLIGHT_DATE.toLocaleDateString()
      }, tooltip, 'danger'))
      .on('mouseleave', () => hideTooltip(tooltip))

    const exStart = new Date(HIGHLIGHT_DATE.setHours(0,0,0,0))
    const exEnd = new Date(HIGHLIGHT_DATE.setHours(23,59,59,999))

    const exclusionRect = highZoneGroup.append('rect')
      .attr('y', 0).attr('height', height)
      .attr('fill', '#ef4444').attr('opacity', 0.15)
      .attr('x', xScale(exStart)).attr('width', xScale(exEnd) - xScale(exStart))

    // Helper for lines in exclusion zone
    const drawExclusionLine = () => highZoneGroup.append('line')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', '#dc2626').attr('stroke-width', 1.2).attr('stroke-dasharray', '6,4')

    const bLeft = drawExclusionLine().attr('x1', xScale(exStart)).attr('x2', xScale(exStart))
    const bRight = drawExclusionLine().attr('x1', xScale(exEnd)).attr('x2', xScale(exEnd))

    // Zoom handler
    const handleZoom = (event) => {
      currentTransform.value = event.transform
      hideTooltip(tooltip)
      const newXScale = event.transform.rescaleX(xScale)
      
      // Update Scale-dependent Elements
      xAxisG.call(d3.axisBottom(newXScale))
      updateVerticalGrid(newXScale)

      // Update Zone
      exclusionRect.attr('x', newXScale(exStart)).attr('width', newXScale(exEnd) - newXScale(exStart))
      bLeft.attr('x1', newXScale(exStart)).attr('x2', newXScale(exStart))
      bRight.attr('x1', newXScale(exEnd)).attr('x2', newXScale(exEnd))

      // Update Data Elements
      dwellBars.attr('x', d => newXScale(d.time)).attr('width', d => newXScale(d.end_time) - newXScale(d.time))
      reportBars.attr('x', r => newXScale(r.day_start)).attr('width', r => newXScale(r.day_end) - newXScale(r.day_start))
      iconGroups.attr('transform', d => 
        `translate(${newXScale(d.date) - 12}, ${yScale(d.target) + yScale.bandwidth()/2 - 12})`
      );
    }

    const zoom = d3.zoom().scaleExtent([1, 100]).on('zoom', handleZoom)
    svg.call(zoom)
    
    // Restore Zoom State if needed
    if(currentTransform.value !== d3.zoomIdentity) svg.call(zoom.transform, currentTransform.value)
  } catch (e) {
    console.error("Render error:", e)
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => { 
  isLoading.value = true

  try {

    const [commList, locs] = await Promise.all([
      getCommodities(),
      getLocations()
    ])

    // Map commodity list to a lookup object for direct access
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

    contextData.commodityNames = commLookup
    contextData.locationKindMap = locKindMap
    contextData.sortedLocations = sortedLocs

    renderChart()
    window.addEventListener('resize', renderChart) 

  } catch (err) { 
    console.error("Data load error:", err) 
  } finally {
    isLoading.value = false;
  }
})

onUnmounted(() => window.removeEventListener('resize', renderChart))

// Watcher to re-render chart on vessel selection change
watch(() => props.vesselData, renderChart)

// Watcher to toggle layer visibility
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

    <div ref="chartContainer" class="w-full min-h-0 flex-grow bg-white"></div>
    <Tooltip v-bind="tooltip" />

    <div class="h-8 shrink-0 border-t border-slate-100 flex items-center justify-end px-4 gap-2 bg-white">
       <span class="text-[9px] font-bold text-gray-400 uppercase mr-2 tracking-widest">Layers</span>
       
       <button @click="layers.pings = !layers.pings" class="layer-btn" :class="layers.pings ? 'text-blue-600 bg-blue-50 border-blue-100' : 'off'">
          Pings
       </button>
       
       <button @click="layers.reports = !layers.reports" class="layer-btn" :class="layers.reports ? 'text-slate-600 bg-slate-100 border-slate-200' : 'off'">
          Reports
       </button>
       
       <button @click="layers.cargo = !layers.cargo" class="layer-btn" :class="layers.cargo ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'off'">
          Cargo
       </button>
       
       <button @click="layers.event = !layers.event" class="layer-btn" :class="layers.event ? 'text-red-600 bg-red-50 border-red-100' : 'off'">
          Event
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