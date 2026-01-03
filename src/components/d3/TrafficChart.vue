<script setup>
import * as d3 from 'd3'
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import Tooltip from '../Tooltip.vue'

const props = defineProps({
    data: Array
})

const emit = defineEmits(['vessel-selected'])
const chartContainer = ref(null)
const tooltip = ref({ 
    visible: false, 
    x: 0, 
    y: 0, 
    contentDict: {} 
})
const selectedVessel = ref(null)
const vesselRegistry = ref({})

const drawChart = () => {
    if (!chartContainer.value || !props.data || props.data.length === 0) {
        if (chartContainer.value) d3.select(chartContainer.value).selectAll('*').remove()
        return
    }
    
    d3.select(chartContainer.value).selectAll('*').remove()
    
    const margin = { top: 20, right: 20, bottom: 30, left: 50 }
    const width = chartContainer.value.clientWidth - margin.left - margin.right
    const height = chartContainer.value.clientHeight - margin.top - margin.bottom

    const groupedData = d3.rollup(props.data,
        (v) => Array.from(new Set(v.map(d => d.target))).sort(),
        (d) => d3.timeDay(new Date(d.time)).getTime(),
        (d) => new Date(d.time).getHours()
    )

    const stripesData = []
    for (const [dayTime, hoursMap] of groupedData) {
        for (const [hour, vessels] of hoursMap) {
            vessels.forEach((vessel, index) => {
                stripesData.push({
                    day: new Date(dayTime),
                    hour: hour,
                    vessel: vessel,
                    index: index,
                    total: vessels.length
                })
            })
        }
    }

    const svg = d3.select(chartContainer.value)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .on('click', (event) => {
            selectedVessel.value = null;
            emit('vessel-selected', null);
            svg.selectAll('.vessel-stripe')
                .transition().duration(200)
                .attr('opacity', 1);
        })
    
    svg.append("defs").append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height)

    const gMain = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleTime()
        .domain(d3.extent(props.data, d => new Date(d.time)))
        .range([0, width])

    const yScale = d3.scaleLinear()
        .domain([0, 24]) 
        .range([height, 0])

    const nightGroup = gMain.append('g').attr('class', 'night-background')
    const nightColor = '#f1f5f9' 
    
    nightGroup.append('rect')
        .attr('x', 0).attr('width', width)
        .attr('y', yScale(6)).attr('height', yScale(0) - yScale(6))
        .attr('fill', nightColor)
        
    nightGroup.append('rect')
        .attr('x', 0).attr('width', width)
        .attr('y', yScale(24)).attr('height', yScale(18) - yScale(24))
        .attr('fill', nightColor)

    gMain.selectAll('.grid-line')
        .data([6, 12, 18])
        .enter().append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
        .attr('stroke', '#cbd5e1').attr('stroke-dasharray', '3,3')

    const xAxisGroup = gMain.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'text-gray-400 text-[10px]')
    
    const xAxis = d3.axisBottom(xScale)
        .ticks(width / 80)
        .tickFormat(d3.timeFormat("%b %d"))
    xAxisGroup.call(xAxis).select(".domain").remove()

    const formatHour = (d) => {
        if (d === 0 || d === 24) return "12 AM";
        if (d === 12) return "12 PM";
        return d < 12 ? `${d} AM` : `${d - 12} PM`;
    };

    const yAxisGroup = gMain.append('g')
        .call(d3.axisLeft(yScale)
        .tickValues([0, 6, 12, 18, 24]) // O aggiungi 3, 9, 15, 21 per più dettagli
        .tickFormat(formatHour))
        .attr('class', 'text-gray-400 text-[10px]')
    yAxisGroup.select(".domain").remove()

    const barsGroup = gMain.append('g')
        .attr("clip-path", "url(#chart-clip)")

    const allVessels = Array.from(new Set(props.data.map(d => d.target))).sort()
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(allVessels)
    const cellHeight = Math.abs(yScale(1) - yScale(0))

    const dateFormatter = d3.timeFormat("%d %b %Y")

    const getOpacity = (d) => {
        if (!selectedVessel.value) return 1;
        return d.vessel === selectedVessel.value ? 1 : 0.1;
    }

    const updateBars = (currentXScale) => {
        const t1 = currentXScale.domain()[0]
        const t2 = d3.timeDay.offset(t1, 1)
        const currentDayWidth = currentXScale(t2) - currentXScale(t1)

        const bars = barsGroup.selectAll('.vessel-stripe')
            .data(stripesData)

        bars.enter()
            .append('rect')
            .attr('class', 'vessel-stripe')
            .merge(bars)
            .attr('y', d => yScale(d.hour + 1)) 
            .attr('height', cellHeight - 0.5)
            .attr('fill', d => colorScale(d.vessel))
            .attr('x', d => currentXScale(d.day) + ((currentDayWidth / d.total) * d.index))
            .attr('width', d => Math.max(0.5, (currentDayWidth / d.total) - 0.5)) 
            .attr('opacity', d => getOpacity(d))
            .style('cursor', 'pointer')
            .on('click', function(event, d) {
                event.stopPropagation(); 
                
                if (selectedVessel.value === d.vessel) {
                    selectedVessel.value = null; 
                } else {
                    selectedVessel.value = d.vessel;
                }
                emit('vessel-selected', selectedVessel.value);

                barsGroup.selectAll('.vessel-stripe')
                    .transition().duration(200)
                    .attr('opacity', d => getOpacity(d));
            })
            .on('mouseover', function(event, d) {
                if (d3.select(this).attr('opacity') > 0.1) d3.select(this).attr('stroke', '#000').attr('stroke-width', 1)
                
                const details = vesselRegistry.value[d.vessel] || { name: d.vessel, company: 'N/A' }

                tooltip.value = {
                    visible: true,
                    x: event.clientX + 15, 
                    y: event.clientY + 15,
                    contentDict: {
                        "Vessel": details.name, 
                        "Company": details.company,
                        "Type": details.vessel_type || 'Unknown',
                        "Tonnage": details.tonnage || 'Unknown',
                        "Date": dateFormatter(d.day),
                        "Hour": `${d.hour}:00 - ${d.hour + 1}:00`
                    }
                }
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', 'none')
                tooltip.value.visible = false
            })

        bars.exit().remove()
    }

    updateBars(xScale)

    const zoom = d3.zoom()
        .scaleExtent([1, 50])
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => {
            const newXScale = event.transform.rescaleX(xScale)
            xAxisGroup.call(xAxis.scale(newXScale))
            updateBars(newXScale)
        })

    svg.call(zoom)
       .on("dblclick.zoom", null)
}

watch(() => props.data, async () => { await nextTick(); drawChart() }, { deep: true })

onMounted(async () => {
    try {
        const res = await fetch('/data/vessels.json')
        const vesselsList = await res.json()

        vesselRegistry.value = vesselsList.reduce((acc, v) => {
            acc[v.id] = { 
                name: v.name, 
                company: v.company || 'Unknown',
                vessel_type: v.vessel_type || 'Unknown',
                tonnage: v.tonnage || 'Unknown'
            }
            return acc
        }, {})
        
        drawChart()
        window.addEventListener('resize', drawChart)
    } catch (e) {
        console.error("Errore caricamento vessels.json:", e)
        drawChart()
    }
})


onUnmounted(() => { window.removeEventListener('resize', drawChart) })
</script>

<template>
    <div class="relative w-full h-full">
        <div ref="chartContainer" class="w-full h-full min-h-0 overflow-hidden bg-white select-none"></div>
        
        <Tooltip 
            :visible="tooltip.visible"
            :x="tooltip.x"
            :y="tooltip.y"
            :content-dict="tooltip.contentDict"
            variant="default" 
        />
    </div>
</template>