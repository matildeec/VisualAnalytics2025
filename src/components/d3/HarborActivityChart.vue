<script setup>
import * as d3 from 'd3';
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import Tooltip from '../Tooltip.vue';
import { getVesselColor, getCommodityColor, getCommodityStatus, showTooltip, hideTooltip } from './utils.js';
import LoadingOverlay from '../LoadingOverlay.vue';

const props = defineProps({ 
  cargoData: { type: Array, default: () => [] },
  vesselData: { type: Array, default: () => [] },
  commodityNames: { type: Object, default: () => ({}) },
  vesselLookup: { type: Object, default: () => ({}) }, // for the tooltip
  hiddenCommodities: { type: Set, default: () => new Set() },
  hiddenVesselTypes: { type: Set, default: () => new Set() }
});

const isLoading = ref(true);
const tooltip = ref({ x: 0, y: 0, contentDict: null, visible: false, variant: 'default' });

const emit = defineEmits(['view-updated']);

const chartContainer = ref(null);
const currentTransform = ref(d3.zoomIdentity);
const brushRange = ref(null);

const MARGIN = { top: 20, right: 15, bottom: 20, left: 60 };
const GAP = 25; 

// Data filtering based on brush selection
const cargoInView = computed(() => {
  if (!props.cargoData.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return props.cargoData
    .filter(d => {
      const isNotFiltered = !props.hiddenCommodities.has(d.commodity);
      const isInBrush = d.date >= minDate && d.date <= maxDate;
      return isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

const vesselsInView = computed(() => {
  if (!props.vesselData.length || !brushRange.value) return [];
  const [minDate, maxDate] = brushRange.value;
  return props.vesselData
    .filter(v => {
      const isNotFiltered = !props.hiddenVesselTypes.has(v.vessel_type);
      const isInBrush = v.date >= minDate && v.date <= maxDate; 
      return isNotFiltered && isInBrush;
    })
    .sort((a, b) => b.date - a.date); 
});

const processStacks = (data, hiddenSet, keyField, valueField, dateField = 'date') => {
  // Filter
  const active = data.filter(d => !hiddenSet.has(d[keyField]));
  const stacks = [];
  const dayTracker = {};

  // Sort and Stack
  active.sort((a,b) => a[dateField] - b[dateField]).forEach(d => {
    const day = d[dateField].toISOString().split('T')[0];
    const base = dayTracker[day] || 0;
    
    stacks.push({ ...d, y0: base, y1: base + d[valueField] });
    dayTracker[day] = base + d[valueField];
  });
  
  return stacks;
};

function updateParentView(minDate, maxDate, cStack, vStack) {
  if (!minDate || !maxDate) {
      emit('view-updated', { cargo: cStack, vessels: vStack });
      return;
  }

  const cInView = cStack.filter(d => d.date >= minDate && d.date <= maxDate);
  const vInView = vStack.filter(v => v.date >= minDate && v.date <= maxDate);
  emit('view-updated', { cargo: cInView, vessels: vInView });
}

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

const renderChart = async () => {
  isLoading.value = true;

  if (!chartContainer.value || props.cargoData.length === 0) {
    isLoading.value = false;
    return;
  }

  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for layout stability

  d3.select(chartContainer.value).selectAll('*').remove();

  try {
    // Responsive Dimensions
    const containerWidth = chartContainer.value.clientWidth;
    const containerHeight = chartContainer.value.clientHeight;
    const width = containerWidth - MARGIN.left - MARGIN.right;
    const height = containerHeight - MARGIN.top - MARGIN.bottom;
    
    // Split height for mirror chart
    const halfHeight = (height - GAP) / 2;
    if (halfHeight <= 0) return; // Container too small

    const cargoTopY = MARGIN.top;
    const cargoBaseY = MARGIN.top + halfHeight; 
    const vesselBaseY = cargoBaseY + GAP;     
    const vesselBottomY = vesselBaseY + halfHeight;  

    // Prepare suspect vessel color map
    const vesselIncidentMap = new Map(); // Key: VesselID, Value: Array of { date, color }

    props.cargoData.forEach(cargo => {
      if (!cargo.suspected_vessels || cargo.suspected_vessels.length === 0) return;
      
      const status = getCommodityStatus(cargo.commodity);
      if (status === 'legal') return;

      let color = null;
      if (status === 'illegal') color = getCommodityColor(cargo.commodity);
      else if (status === 'suspect') color = d3.color(getCommodityColor(cargo.commodity));

      if (color) {
        cargo.suspected_vessels.forEach(vId => {
          if (!vesselIncidentMap.has(vId)) vesselIncidentMap.set(vId, []);
          vesselIncidentMap.get(vId).push({ 
              date: new Date(cargo.date),
              color: color 
          });
        });
      }
    });

    // Order dates
    vesselIncidentMap.forEach(events => events.sort((a, b) => a.date - b.date));

    // Process stacks
    const cargoStack = processStacks(props.cargoData, props.hiddenCommodities, 'commodity', 'qty');
    const vesselStack = processStacks(props.vesselData, props.hiddenVesselTypes, 'vessel_type', 'tonnage');

    // We match vessels according to time
    vesselStack.forEach(v => {
        const incidents = vesselIncidentMap.get(v.source); // v.source è l'ID nave
        if (incidents) {
            // Threshold of 2 days     
            const MAX_DELAY = 2 * 24 * 60 * 60 * 1000; 
            
            const match = incidents.find(i => i.date >= v.date);
            
            if (match && (match.date - v.date) <= MAX_DELAY) {
                v.suspectColor = match.color;
            }
        }
    });
 
    // Combine dates for X domain
    const allDates = [...cargoStack.map(d => d.date), ...vesselStack.map(d => d.date)];
    const dateExtent = allDates.length ? d3.extent(allDates) : [new Date('2024-01-01'), new Date('2024-12-31')];

    // SVG Setup
    const svg = d3.select(chartContainer.value).append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'chart-content-clip').append('rect')
      .attr('x', 0).attr('y', -halfHeight)
      .attr('width', width).attr('height', height + GAP);

    // Scales
    const xScale = d3.scaleTime().domain(dateExtent).range([0, width]);

    const yCargoScale = d3.scaleLinear()
        .domain([0, d3.max(cargoStack, d => d.y1) * 1.1 || 100])
        .range([0, -halfHeight]); // Grows Upwards
    
    const yVesselScale = d3.scaleLinear()
        .domain([0, d3.max(vesselStack, d => d.y1) * 1.1 || 100])
        .range([0, halfHeight]); // Grows Downwards

    svg.append('g')
      .attr('class', 'grid-horizontal')
      .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`)
      .call(d3.axisLeft(yCargoScale)
          .ticks(5)
          .tickSize(-width)
          .tickFormat('')
      )
      .call(g => g.select(".domain").remove())
      .selectAll("line")
      .attr("stroke", "var(--chart-grid-line)")
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.3);

    // Grid for Vessel Chart
    svg.append('g')
      .attr('class', 'grid-horizontal')
      .attr('transform', `translate(${MARGIN.left},${vesselBaseY})`)
      .call(d3.axisLeft(yVesselScale)
          .ticks(5)
          .tickSize(-width)
          .tickFormat('')
      )
      .call(g => g.select(".domain").remove())
      .selectAll("line")
      .attr("stroke", "var(--chart-grid-line)")
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.3);

    // Grid for Vertical Lines
    const gGridVertical = svg.append('g')
        .attr('class', 'grid-vertical')
        .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`);

    const updateVerticalGrid = (currentScale) => {
        const ticks = currentScale.ticks(10);
        
        gGridVertical.selectAll('line')
            .data(ticks)
            .join(
                enter => enter.append('line')
                    .attr('stroke', 'var(--chart-grid-line)')
                    .attr('stroke-dasharray', '2,2')
                    .attr('opacity', 0.5),
                update => update,
                exit => exit.remove()
            )
            .attr('x1', d => currentScale(d))
            .attr('x2', d => currentScale(d))
            .attr('y1', -halfHeight) 
            .attr('y2', halfHeight + GAP); 
    }

    // Render iniziale
    updateVerticalGrid(xScale);

    // Draw Axes
    const xAxisMiddle = svg.append('g')
      .attr('class', 'x-axis text-[var(--chart-axis-line)]')
      .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`)
      .call(d3.axisBottom(xScale)
        .ticks(10)
        .tickSizeOuter(0));

    const xAxisTop = svg.append('g')
      .attr('class', 'x-axis text-[var(--chart-axis-line)]')
      .attr('transform', `translate(${MARGIN.left},${vesselBaseY})`)
      .call(d3.axisTop(xScale)
        .ticks(10)
        .tickFormat(""));

    // Y Axes
    svg.append('g')
      .attr('class', 'text-[var(--chart-axis-line)]')
      .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`)
      .call(d3.axisLeft(yCargoScale).ticks(5));
      
    svg.append('g')
      .attr('class', 'text-[var(--chart-axis-line)]')
      .attr('transform', `translate(${MARGIN.left},${vesselBaseY})`)
      .call(d3.axisLeft(yVesselScale).ticks(5));

    // Brush Setup
    const brush = d3.brushX()
      .extent([[0, -halfHeight], [width, halfHeight * 2 + GAP]]) // Cover usable area
      .filter(event => event.shiftKey)
      .on('brush end', (event) => {
        if (event.selection) {
          const [x0, x1] = event.selection;
          const activeX = currentTransform.value.rescaleX(xScale);
          const minDate = activeX.invert(x0);
          const maxDate = activeX.invert(x1);
          brushRange.value = [minDate, maxDate];
          
          // Emit filtered data to parent immediately
          updateParentView(minDate, maxDate, cargoStack, vesselStack);
        } else {
          brushRange.value = null;
          updateParentView(null, null, cargoStack, vesselStack); // Reset view
        }
      });

    const brushG = svg.append('g')
      .attr('class', 'brush')
      .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`)
      .call(brush);

    // Draw Bars
    const gCargo = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${cargoBaseY})`)
      .attr('clip-path', 'url(#chart-content-clip)');
      
    const cargoBars = gCargo.selectAll('.bar-cargo')
      .data(cargoStack)
      .enter().append('rect')
      .attr('class', 'bar-element')
      .attr('x', d => xScale(d.date) - 3)
      .attr('y', d => yCargoScale(d.y1))
      .attr('width', 6)
      .attr('height', d => Math.abs(yCargoScale(d.y1) - yCargoScale(d.y0)))
      .attr('fill', d => getCommodityColor(d.commodity))
      .attr('stroke', 'black').attr('stroke-width', 0.2)
      .attr('rx', 1)
      .on('mouseenter', (e, d) => handleTooltip(e, d, 'cargo'))
      .on('mouseleave', () => hideTooltip(tooltip));

    const gVessel = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${vesselBaseY})`)
      .attr('clip-path', 'url(#chart-content-clip)');

    const vesselNodes = gVessel.selectAll('.vessel-node')
      .data(vesselStack)
      .enter().append('g')
      .attr('class', 'vessel-node')
      .attr('transform', d => `translate(${xScale(d.date)}, 0)`);

    // Anchor line
    vesselNodes.append('line')
      .attr('y1', 0)
      .attr('y2', d => yVesselScale(d.y1))
      .attr('stroke', d => getVesselColor(d.vessel_type))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,1')
      .attr('opacity', 0.5);

    // External Circle
    vesselNodes.append('circle')
      .attr('cy', d => yVesselScale(d.y1))
      .attr('r', 5)
      .attr('fill', d => {
          // Use color of commodity if illegal
          if (d.suspectColor) return d.suspectColor;
          return getVesselColor(d.vessel_type);
      })
      .attr('opacity', d => {
          return d.suspectColor ? 0.8 : 0;
      });

    // Internal Circle
    vesselNodes.append('circle')
      .attr('cy', d => yVesselScale(d.y1))
      .attr('r', 2.5)
      .attr('fill', d => getVesselColor(d.vessel_type))
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('mouseenter', (e, d) => handleTooltip(e, d, 'vessel'))
      .on('mouseleave', () => hideTooltip(tooltip));

    // Zoom
    const handleZoom = (event) => {
      currentTransform.value = event.transform;
      hideTooltip(tooltip);
      brushG.call(brush.move, null);

      const newXScale = event.transform.rescaleX(xScale);

      // Update Bars
      cargoBars.attr('x', d => newXScale(d.date) - 3);
      vesselNodes.attr('transform', d => `translate(${newXScale(d.date)}, 0)`);
      
      // Update Axis
      xAxisMiddle.call(d3.axisBottom(newXScale));
      xAxisTop.call(d3.axisTop(newXScale)
        .ticks(10)
        .tickFormat("")
        .tickSize(4)
      );

      // Update Vertical Grid
      updateVerticalGrid(newXScale);
      
      // Reset Brush visual
      brushG.call(brush.move, null); 
      brushRange.value = null;
      updateParentView(null, null, cargoStack, vesselStack); // Reset view filter on zoom
    };

    const zoom = d3.zoom()
      .scaleExtent([1, 100])
      .filter(event => !event.shiftKey)
      .on('zoom', handleZoom);

    svg.call(zoom);
    if(currentTransform.value !== d3.zoomIdentity) svg.call(zoom.transform, currentTransform.value);

  } catch (e) {
    console.error("Error rendering chart:", e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
    renderChart();
    window.addEventListener('resize', renderChart);
});

onUnmounted(() => window.removeEventListener('resize', renderChart));

// Emit view updates
watch([cargoInView, vesselsInView], ([newCargo, newVessels]) => {
  emit('view-updated', { cargo: newCargo, vessels: newVessels });
});

// Re-render chart on data or filter changes
watch(
  [() => props.cargoData, () => props.vesselData, () => props.hiddenCommodities, () => props.hiddenVesselTypes], 
  renderChart, 
  { deep: true }
);
</script>

<template>
  <div class="relative w-full h-full flex flex-col justify-between overflow-hidden">

    <LoadingOverlay :loading="isLoading" message="Loading Visualization..." />

    <div class="h-8 shrink-0 border-b border-slate-100 flex items-center justify-between px-4 gap-2 bg-white">
      <span class="text-[9px] font-medium text-slate-500 mr-2">Total Weight (Tons)</span>     
      <span class="text-[10px] font-bold text-[var(--main-deep-blue)] uppercase mr-2 tracking-widest">Exported Cargo</span>     
    </div>

    <div ref="chartContainer" class="w-full flex-1 flex-grow bg-white cursor-crosshair"></div>
    <Tooltip v-bind="tooltip" />

    <div class="h-8 shrink-0 border-t border-slate-100 flex items-center justify-between px-4 gap-2 bg-white">
      <span class="text-[9px] font-medium text-slate-500 mr-2">Gross Tonnage (GT)</span>     
      <span class="text-[10px] font-bold text-[var(--main-deep-blue)] uppercase mr-2 tracking-widest">Docked Vessels</span>     
    </div>

  </div>

</template>