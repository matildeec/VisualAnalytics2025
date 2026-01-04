<script setup>
import * as d3 from 'd3'
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import Tooltip from '../Tooltip.vue'
import LoadingOverlay from '../LoadingOverlay.vue'
import { getVesselColor, showTooltip, hideTooltip } from './utils'

// Props to receive ping data from parent
const props = defineProps({
    data: Array
})

// Emit event when a vessel is selected
const emit = defineEmits(['vessel-selected'])

// Constants
const TARGET_COMPANY = "SouthSeafood Express Corp" 
const MARGIN = { top: 0, right: 20, bottom: 0, left: 260 }
const AXIS_HEIGHT = 30
const PINNED_ROW_HEIGHT = 50 
const ROW_HEIGHT = 42
const PING_WIDTH = 2

// DOM References for SVG containers
const headerContainer = ref(null)
const bodyContainer = ref(null)

// Reactive State
const isLoading = ref(true)
const tooltip = ref({ visible: false, x: 0, y: 0, contentDict: {} })
const selectedVesselId = ref(null)
const vesselRegistry = ref({})

/**
 * Renders a single vessel row (Label + Timeline Pings) into a specific container.
 * Used for both the main list and the pinned header.
 * * @param {Object} container - D3 selection of the parent group.
 * @param {Object} d - The data object for the vessel.
 * @param {Function} yScale - D3 scale for vertical positioning (null if pinned).
 * @param {Function} xScale - D3 scale for horizontal time positioning.
 * @param {boolean} isPinned - Flag to determine styling (highlighted/static).
 */
const renderVesselRow = (container, d, yScale, xScale, isPinned = false) => {
    const g = container.append('g')
        .attr('class', 'vessel-row-group')
        .attr('transform', yScale ? `translate(0, ${yScale(d.id)})` : `translate(0, 0)`);

    const isTarget = d.company === TARGET_COMPANY;

    // Background logic: if pinned, highlight bg; if target, highlight border
    let bgFill = 'var(--chart-bg-default)';

    if (isPinned) bgFill = 'var(--chart-bg-pinned)';
    else if (isTarget) bgFill = 'var(--chart-row-highlight-bg)';

    // Background Rectangle with hover and click events
    g.append('rect')
        .attr('x', -MARGIN.left)
        .attr('y', 0)
        .attr('width', '100%') 
        .attr('height', isPinned ? PINNED_ROW_HEIGHT : ROW_HEIGHT)
        .attr('fill', bgFill) 
        .attr('stroke-left', isTarget && !isPinned ? 'var(--chart-text-highlight)' : 'none')
        .attr('stroke-width', 4)
        .on('mouseenter', function() { 
            if(!isPinned) {
                d3.select(this).attr('fill', isTarget ? 'var(--chart-row-highlight-hover)' : 'var(--chart-row-hover)') 
            }
        })
        .on('mouseleave', function() { 
            if(!isPinned) d3.select(this).attr('fill', bgFill) 
        })
        .on('click', () => handleVesselClick(d.id));
    
    // If target vessel and not pinned, add left border highlight
    if (isTarget && !isPinned) {
        g.append('rect')
            .attr('x', -MARGIN.left)
            .attr('y', 0)
            .attr('width', 4)
            .attr('height', ROW_HEIGHT)
            .attr('fill', 'var(--chart-text-highlight)');
    }

    // Line separator for pinned row
    if (isPinned) {
        g.append('line')
            .attr('x1', -MARGIN.left).attr('x2', 20000)
            .attr('y1', PINNED_ROW_HEIGHT).attr('y2', PINNED_ROW_HEIGHT);
        
        g.append('text')
            .text("PINNED")
            .attr('x', -MARGIN.left + 10).attr('y', 10)
            .style('font-size', '9px')
            .style('fill', 'var(--chart-text-pinned)')
            .style('font-weight', 'bold');
    }

    // Labels Group
    const labelY = isPinned ? PINNED_ROW_HEIGHT / 2 : ROW_HEIGHT / 2;
    const labelGroup = g.append('g')
        .attr('transform', `translate(0, ${labelY})`)
        .style('pointer-events', 'none');

    const colorVar = getVesselColor(d.type);

    // Vessel Name
    const nameText = labelGroup.append('text')
        .text(d.name.length > 25 ? d.name.substring(0,25)+'...' : d.name)
        .attr('x', -15).attr('y', -3)
        .style('font-size', '11px')
        .style('font-weight', isTarget ? '800' : '700') 
        .style('fill', isTarget ? 'var(--chart-text-highlight-dark)' : 'var(--chart-text-main)')
        .style('text-anchor', 'end');

    // Vessel Type Badge
    const badgeRightX = nameText.node().getBBox().x - 6;
    const typeLabel = d.type === 'Unknown' ? '?' : d.type;
    const badgeText = labelGroup.append('text')
        .text(typeLabel)
        .attr('x', badgeRightX).attr('y', -3)
        .style('font-size', '9px').style('font-weight', '600')
        .style('fill', colorVar).style('text-anchor', 'end');
    
    const badgeBBox = badgeText.node().getBBox();
    labelGroup.insert('rect', 'text')
        .attr('x', badgeBBox.x - 4).attr('y', badgeBBox.y - 1)
        .attr('width', badgeBBox.width + 8).attr('height', badgeBBox.height + 2)
        .attr('fill', colorVar).attr('fill-opacity', 0.15).attr('rx', 3);

    // Company name
    labelGroup.append('text')
        .text(d.company.length > 35 ? d.company.substring(0,35)+'...' : (d.company || 'Unknown'))
        .attr('x', -15).attr('y', 10)
        .style('font-size', '10px')
        .style('fill', isTarget ? 'var(--chart-text-highlight)' : 'var(--chart-text-muted)')
        .style('font-weight', isTarget ? '600' : '400')
        .style('font-style', 'italic').style('text-anchor', 'end');

    // Pings rendering
    const pingsG = g.append('g').attr('clip-path', 'url(#clip-body)');
    const rectHeight = isPinned ? (PINNED_ROW_HEIGHT - 20) : (ROW_HEIGHT - 12);
    const rectY = isPinned ? 10 : 6;

    pingsG.selectAll('.ping-rect')
        .data(d.pings)
        .enter()
        .append('rect')
        .attr('class', 'ping-rect')
        .attr('x', p => xScale(p.time))
        .attr('y', rectY) 
        .attr('height', rectHeight)
        .attr('width', PING_WIDTH)
        .attr('fill', 'var(--chart-ping-neutral)')
        .attr('opacity', 0.7)
        .attr('rx', 1)
        .on('mouseover', (event, p) => {
            const details = vesselRegistry.value[p.target] || { name: p.target }

            showTooltip(event, {
                "Vessel": details.name,
                "Company": details.company,
                "Time": d3.timeFormat("%d %b %H:%M")(p.time)
            }, tooltip);
        })
        .on('mouseout', () => { hideTooltip(tooltip) });
}

// Main function to draw the entire chart
const renderChart = async () => {
    isLoading.value = true;

    // Wait for DOM update
    if (!headerContainer.value || !bodyContainer.value) return
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear previous contents
    d3.select(headerContainer.value).selectAll('*').remove()
    d3.select(bodyContainer.value).selectAll('*').remove()

    if (!props.data || props.data.length === 0) {
        isLoading.value = false;
        return
    }

    try {
        const rawNested = d3.groups(props.data, d => d.target);
        const sortedVessels = rawNested.map(([id, values]) => {
            const info = vesselRegistry.value[id] || { name: id, vessel_type: 'Unknown', company: 'Unknown' };
            const sortedPings = values.slice().sort((a, b) => new Date(a.time) - new Date(b.time));
            
            const pingsWithDwell = sortedPings.map((p) => ({
                ...p, // Spread syntax to copy existing properties and only modify specific ones
                time: new Date(p.time)
            }));

            return { id, name: info.name, type: info.vessel_type, company: info.company, pings: pingsWithDwell }
        }).sort((a, b) => {
            const isATarget = a.company === TARGET_COMPANY;
            const isBTarget = b.company === TARGET_COMPANY;
            if (isATarget && !isBTarget) return -1; 
            if (!isATarget && isBTarget) return 1;
            return a.name.localeCompare(b.name);
        });

        // SVG setup
        const width = headerContainer.value.clientWidth - MARGIN.left - MARGIN.right
        const bodyHeight = sortedVessels.length * ROW_HEIGHT
        const totalHeaderHeight = AXIS_HEIGHT + PINNED_ROW_HEIGHT + 10; 

        const headerSvg = d3.select(headerContainer.value).append('svg')
            .attr('width', width + MARGIN.left + MARGIN.right)
            .attr('height', totalHeaderHeight)
            .style('display', 'block').style('overflow', 'visible');

        const gAxis = headerSvg.append('g').attr('transform', `translate(${MARGIN.left}, ${AXIS_HEIGHT})`);
        const gPinned = headerSvg.append('g').attr('transform', `translate(${MARGIN.left}, ${AXIS_HEIGHT + 10})`);

        const bodySvg = d3.select(bodyContainer.value).append('svg')
            .attr('width', width + MARGIN.left + MARGIN.right)
            .attr('height', bodyHeight)
            .style('display', 'block');

        const gBody = bodySvg.append('g').attr('transform', `translate(${MARGIN.left}, 0)`);

        // Define clip paths to avoid overflow of pings outside chart area when scrolling to zoom
        const defs = bodySvg.append('defs');
        defs.append("clipPath").attr("id", "clip-body").append("rect").attr("width", width).attr("height", 10000);
        headerSvg.append("defs").append("clipPath").attr("id", "clip-header").append("rect").attr("width", width).attr("height", PINNED_ROW_HEIGHT);

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(props.data, d => new Date(d.time)))
            .range([0, width]);
        const yScale = d3.scaleBand()
            .domain(sortedVessels.map(d => d.id))
            .range([0, bodyHeight])
            .padding(0.1);

        // X Axis
        const xAxis = d3.axisTop(xScale)
            .ticks(width / 80)
            .tickFormat(d3.timeFormat("%d %b"))
            .tickSizeOuter(0);
        const xAxisGroup = gAxis.append('g')
            .attr('class', 'x-axis text-gray-500 text-[10px]')
            .call(xAxis);
        xAxisGroup.select(".domain").remove(); // Remove axis line for cleaner look

        // Pinned Row Logic
        if (selectedVesselId.value) {
            const pinnedData = sortedVessels.find(v => v.id === selectedVesselId.value);
            if (pinnedData) renderVesselRow(gPinned, pinnedData, null, xScale, true);
        } else {
            gPinned.append('rect')
                .attr('width', width + MARGIN.left + MARGIN.right)
                .attr('x', -MARGIN.left)
                .attr('height', PINNED_ROW_HEIGHT)
                .attr('fill', 'var(--chart-bg-pinned)');
            
            gPinned.append('text')
                .text("Click on a vessel to pin it. Click back here to unpin it.")
                .attr('x', width / 2)
                .attr('y', PINNED_ROW_HEIGHT / 2)
                .attr('dy', '0.3em')
                .attr('text-anchor', 'middle')
                .style('fill', 'var(--chart-text-pinned)')
                .style('font-size', '12px');
        }

        // Grid lines and rows
        const gGrid = gBody.append('g').attr('class', 'grid-layer');
        const gridAxisX = d3.axisTop(xScale)
            .ticks(width / 80)
            .tickSize(-bodyHeight)
            .tickFormat('').tickSizeOuter(0);
        const gGridVertical = gGrid.append('g')
            .attr('class', 'grid-vertical')
            .attr('opacity', 0.5)
            .call(gridAxisX);
        gGridVertical.selectAll('line')
            .attr('stroke', 'var(--chart-grid-line)')
            .attr('stroke-dasharray', '2,2');
        gGridVertical.select('.domain').remove(); // Remove domain line for cleaner look

        gGrid.selectAll('.grid-horizontal-line').data(sortedVessels).enter().append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', d => yScale(d.id) + yScale.bandwidth())
            .attr('y2', d => yScale(d.id) + yScale.bandwidth())
            .attr('stroke', 'var(--chart-grid-line)').attr('stroke-width', 1).attr('opacity', 0.3);

        const gRows = gBody.append('g').attr('class', 'rows-layer');

        // Render all vessel rows
        sortedVessels.forEach(v => {
            const rowContainer = gRows.append('g'); 
            renderVesselRow(rowContainer, v, yScale, xScale, false);
        });

        // Zoom and pan behavior
        const zoom = d3.zoom()
            .scaleExtent([1, 100])
            .translateExtent([[0, 0], [width, bodyHeight]])
            .extent([[0, 0], [width, bodyHeight]])
            .filter(function(event) {
                if (event.type === 'wheel') {
                    const [x] = d3.pointer(event, bodySvg.node());
                    return x >= MARGIN.left;
                }
                return true;
            })
            .on("zoom", (event) => {
                const t = event.transform;
                const newXScale = t.rescaleX(xScale);
                
                if (t.k > 5) xAxis.tickFormat(d3.timeFormat("%d %b (%H:%M)"));
                else xAxis.tickFormat(d3.timeFormat("%d %b"));
                
                xAxisGroup.call(xAxis.scale(newXScale));
                xAxisGroup.select(".domain").remove();

                gGridVertical.call(gridAxisX.scale(newXScale));
                gGridVertical.selectAll('line').attr('stroke', 'var(--chart-grid-line)').attr('stroke-dasharray', '2,2');
                gGridVertical.select('.domain').remove();

                gBody.selectAll('.ping-rect').attr('x', d => newXScale(d.time));
                gPinned.selectAll('.ping-rect').attr('x', d => newXScale(d.time));
            });

        bodySvg.call(zoom).on("dblclick.zoom", null);

    } catch (e) {
        console.error("Error drawing chart:", e);
    } finally {
        isLoading.value = false;
    }
}

/**
 * Handles clicks on vessel rows. Toggles selection state.
 * @param {string} vesselId 
 */
function handleVesselClick(vesselId) {
    selectedVesselId.value = (selectedVesselId.value === vesselId) ? null : vesselId;
    emit('vessel-selected', selectedVesselId.value);
    renderChart();
}

// Redraw chart when data or selection changes
watch(() => props.data, async () => { 
    await renderChart() }, 
    { deep: true }
)

onMounted(async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/data/vessels.json')
        const vesselsList = await res.json()
        vesselRegistry.value = vesselsList.reduce((acc, v) => {
            acc[v.id] = { ...v, company: v.company || 'Unknown', vessel_type: v.vessel_type || 'Unknown' }
            return acc
        }, {})
        await renderChart()
        window.addEventListener('resize', renderChart)
    } catch (e) { console.error(e); isLoading.value = false; }
})

onUnmounted(() => { window.removeEventListener('resize', renderChart) })
</script>

<template>
    <div class="relative w-full h-full flex flex-col overflow-hidden">
        
        <LoadingOverlay :loading="isLoading" message="Loading Visualization..." />

        <div ref="headerContainer" class="w-full h-[90px] shrink-0 bg-white border-b border-gray-100 z-10 shadow-sm relative"></div>
        <div ref="bodyContainer" class="w-full flex-1 overflow-y-auto overflow-x-hidden relative"></div>
        <Tooltip :visible="tooltip.visible" :x="tooltip.x" :y="tooltip.y" :content-dict="tooltip.contentDict" />
    </div>
</template>