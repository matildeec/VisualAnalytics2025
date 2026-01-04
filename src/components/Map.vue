<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet Default Icon Fix: sometimes icons don't load correctly without this
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
})

// Emit event when a feature (zone) is clicked
const emit = defineEmits(['feature-clicked'])

// References to DOM elements
const mapContainer = ref(null)
const legendRef = ref(null)

// Other variables
let map = null
let geoJsonLayer = null
let selectedLayer = null 

const categories = [
    { label: 'Island', color: 'var(--zone-island-bg)', border: 'var(--zone-island-border)', check: (k) => k === 'Island' },
    { label: 'Fishing Zone', color: 'var(--zone-fishing-bg)', border: 'var(--zone-fishing-border)', check: (k) => k.includes('Fishing') },
    { label: 'Preserve', color: 'var(--zone-preserve-bg)', border: 'var(--zone-preserve-border)', check: (k) => k.includes('Preserve') },
    { label: 'Buoy', color: 'var(--zone-buoy-bg)', border: 'var(--zone-buoy-border)', check: (k) => k.includes('buoy') },
    { label: 'City', color: 'var(--zone-city-bg)', border: 'var(--zone-city-border)', check: (k) => k.includes('city') }
];

/**
 * Determines the Leaflet style object based on GeoJSON feature properties.
 * It maps specific feature kinds to defined categories for coloring and opacity.
 *
 * @param {Object} feature - The GeoJSON feature object containing properties (e.g., 'type', '*Kind').
 * @returns {L.PathOptions} An object containing style options (fillColor, color, weight, fillOpacity).
 */
const getRegionStyle = (feature) => {
    const kind = feature.properties?.['*Kind'] || feature.properties?.type || '';
    const category = categories.find(c => c.check(kind));
    
    if (!category) return { 
        fillColor: 'var(--zone-default-bg)', 
        color: 'var(--zone-default-border)', 
        weight: 1, 
        fillOpacity: 0.3 
    };

    return { 
        fillColor: category.color, 
        color: category.border, 
        weight: category.label.includes('Fishing') ? 2 : 1,
        fillOpacity: category.label === 'Island' ? 0.8 : 0.5
    };
};

/**
 * Attaches event listeners (click, mouseover, mouseout) to a specific map layer.
 * Handles selection highlighting, hover effects, and emits the 'feature-clicked' event.
 *
 * @param {Object} feature - The GeoJSON feature data associated with the layer.
 * @param {L.Layer} layer - The Leaflet layer instance representing the feature.
 */
const handleFeatureEvents = (feature, layer) => {
    layer.on({
        click: (e) => {
            if (selectedLayer && geoJsonLayer) geoJsonLayer.resetStyle(selectedLayer);
            selectedLayer = layer;
            if (layer.setStyle) {
                layer.setStyle({ 
                    color: 'var(--state-selected-border)', 
                    weight: 4, 
                    fillOpacity: 0.8, 
                    fillColor: 'var(--state-selected-bg)' 
                });
                layer.bringToFront();
            }
            if (feature.geometry.type !== 'Point' && geoJsonLayer) {
                geoJsonLayer.eachLayer((l) => { if (l.feature.geometry.type === 'Point') l.bringToFront(); });
            }
            emit('feature-clicked', feature);            
            L.DomEvent.stopPropagation(e);
        },
        mouseover: (e) => {
            if (e.target !== selectedLayer && e.target.setStyle) {
                // Variabili per lo stato "Hover"
                e.target.setStyle({ 
                    weight: 3, 
                    color: 'var(--state-hover-border)', 
                    fillOpacity: 0.7 
                });
            }
        },
        mouseout: (e) => {
            if (e.target !== selectedLayer && geoJsonLayer) geoJsonLayer.resetStyle(e.target);
        }
    });
};

/**
 * Initializes the Leaflet map, mounts it to the DOM, and asynchronously fetches GeoJSON data.
 * It also configures the custom legend control and fits the map bounds to the data.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the map initialization is complete.
 */
async function initMap() {
    if (!mapContainer.value) return;
    
    map = L.map(mapContainer.value, {
        zoomControl: true,
        attributionControl: false
    }).setView([39.75, -166.0], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    if (legendRef.value) {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = legendRef.value;
            L.DomEvent.disableClickPropagation(div);
            return div;
        };
        legend.addTo(map);
    }

    try {
        const response = await fetch('/data/oceanus.geojson');
        const geojsonData = await response.json();

        geoJsonLayer = L.geoJSON(geojsonData, {
            style: getRegionStyle,
            onEachFeature: handleFeatureEvents,
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, fillOpacity: 0.8 })
        }).addTo(map);

        if (geojsonData.features?.length) {
            map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
        }
    } catch (err) { console.error(err); }
}

// Initialize the map when the component is mounted
onMounted(initMap);

// Clean up the map instance to make sure there are no memory leaks
onBeforeUnmount(() => { if (map) map.remove(); });
</script>

<template>
    <div class="relative w-full h-full">
        <div ref="mapContainer" class="w-full h-full bg-slate-100 z-0"></div>

        <div ref="legendRef" class="leaflet-legend-container bg-white/90 backdrop-blur-sm p-2 rounded shadow-sm border border-slate-200/50">
            <h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Zones</h5>
            
            <div class="flex flex-col gap-1">
                <div v-for="(cat, index) in categories" :key="index" class="flex items-center">
                    <span 
                        class="w-2 h-2 rounded-full mr-1.5 shadow-sm"
                        :style="{ backgroundColor: cat.color, border: `1px solid ${cat.border}` }"
                    ></span>
                    <span class="text-[10px] text-slate-600 font-medium leading-none">{{ cat.label }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
.leaflet-legend-container {
    min-width: auto; 
    margin-bottom: 5px !important; 
    margin-right: 5px !important;
}
</style>