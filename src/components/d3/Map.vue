<script setup>
import { ref, onMounted, onBeforeUnmount, h, render } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import InfoCard from '../InfoCard.vue'

// Import default marker icons from Leaflet to fix missing icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Delete default icon URLs to avoid issues with bundlers
delete L.Icon.Default.prototype._getIconUrl;

// Set custom icon URLs
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const mapContainer = ref(null)
let map = null
let geoJsonLayer = null

const getRegionStyle = (feature) => {
    const kind = feature.properties?.['*Kind'] || '';
    if (kind === 'Island') return { fillColor: '#dcd5c5', color: '#9a8c73', weight: 2, fillOpacity: 0.8 };
    if (feature.properties?.type?.includes('Harbor')) return { fillColor: '#3b82f6', color: '#1d4ed8', weight: 3, fillOpacity: 0.6 };
    return { fillColor: '#e2e8f0', color: '#94a3b8', weight: 1, fillOpacity: 0.4 };
};

const createPopupContent = (feature) => {
    const container = document.createElement('div');
    
    const vnode = h(InfoCard, {
        vessel: feature.properties.Name,
        kind: feature.properties['*Kind'] || feature.properties.type,
        description: feature.properties.Description,
        activities: feature.properties.Activities || [],
        species: feature.properties.fish_species_present || []
    });

    render(vnode, container);
    
    return container;
};

const handleFeatureEvents = (feature, layer) => {
    layer.bindPopup(createPopupContent(feature), {
        maxWidth: 300,
        className: 'custom-popup'
    });

    layer.on({
        mouseover: (e) => {
            const el = e.target;
            // Controlla se l'elemento supporta setStyle (solo Poligoni e Linee)
            if (typeof el.setStyle === 'function') {
                el.setStyle({ 
                    fillOpacity: 0.9, 
                    weight: 4, 
                    color: '#2563eb' 
                });
            }
            
            if (typeof el.bringToFront === 'function') {
                el.bringToFront();
            }
        },
        mouseout: (e) => {
            const el = e.target;
            if (geoJsonLayer && typeof el.setStyle === 'function') {
                geoJsonLayer.resetStyle(el);
            }
        }
    });
};

async function initMap() {
    if (!mapContainer.value) return;
    map = L.map(mapContainer.value).setView([39.75, -166.0], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    try {
        const response = await fetch('/data/oceanus.geojson');
        const geojsonData = await response.json();

        geoJsonLayer = L.geoJSON(geojsonData, {
            style: getRegionStyle,
            onEachFeature: handleFeatureEvents
        }).addTo(map);

        if (geojsonData.features?.length) {
            map.fitBounds(geoJsonLayer.getBounds(), { padding: [30, 30] });
        }
    } catch (err) { console.error(err); }
}

onMounted(initMap);
onBeforeUnmount(() => { if (map) map.remove(); });
</script>

<template>
    <div ref="mapContainer" class="w-full h-full min-h-[500px] rounded-xl shadow-inner bg-slate-200 overflow-hidden border border-slate-300"></div>
</template>

<style scoped>
:deep(.leaflet-container) {
    width: 100%;
    height: 100%;
}

:deep(.leaflet-popup) {
    border-radius: 12px;
    border: 1px solid #ccc;
    background-color: #fff;
}

:deep(.leaflet-popup-content) {
    margin: 8px;
    line-height: inherit;
}

:deep(.leaflet-popup-content-wrapper) {
    border-radius: 12px;
}
</style>