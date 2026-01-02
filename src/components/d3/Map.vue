<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default icon paths
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
})

const emit = defineEmits(['feature-clicked'])
const mapContainer = ref(null)
let map = null
let geoJsonLayer = null
let selectedLayer = null 

const getRegionStyle = (feature) => {
    const kind = feature.properties?.['*Kind'] || feature.properties?.type || '';
    if (kind === 'Island') return { fillColor: '#dcd5c5', color: '#9a8c73', weight: 1, fillOpacity: 0.8 };
    if (kind.includes('Harbor') || kind.includes('Fishing')) return { fillColor: '#3b82f6', color: '#1d4ed8', weight: 2, fillOpacity: 0.5 };
    return { fillColor: '#94a3b8', color: '#64748b', weight: 1, fillOpacity: 0.3 };
};

const handleFeatureEvents = (feature, layer) => {
    layer.on({
        click: (e) => {
            if (selectedLayer && geoJsonLayer) {
                geoJsonLayer.resetStyle(selectedLayer);
            }

            selectedLayer = layer;
            if (layer.setStyle) {
                layer.setStyle({
                    color: '#f59e0b',
                    weight: 4,
                    fillOpacity: 0.8,
                    fillColor: '#fbbf24'
                });
                layer.bringToFront();
            }

            if (feature.geometry.type !== 'Point' && geoJsonLayer) {
                    geoJsonLayer.eachLayer((l) => {
                        if (l.feature.geometry.type === 'Point') {
                            l.bringToFront();
                        }
                    });
                }

            emit('feature-clicked', feature);            
            L.DomEvent.stopPropagation(e);
        },
        mouseover: (e) => {
            if (e.target !== selectedLayer && e.target.setStyle) {
                e.target.setStyle({ weight: 3, color: '#2563eb', fillOpacity: 0.7 });
            }
        },
        mouseout: (e) => {
            if (e.target !== selectedLayer && geoJsonLayer) {
                geoJsonLayer.resetStyle(e.target);
            }
        }
    });
};

async function initMap() {
    if (!mapContainer.value) return;
    map = L.map(mapContainer.value, {
        zoomControl: true,
        attributionControl: false
    }).setView([39.75, -166.0], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    try {
        const response = await fetch('/data/oceanus.geojson');
        const geojsonData = await response.json();

        geoJsonLayer = L.geoJSON(geojsonData, {
            style: getRegionStyle,
            onEachFeature: handleFeatureEvents,
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillOpacity: 0.8
                });
            }
        }).addTo(map);

        if (geojsonData.features?.length) {
            map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
        }
    } catch (err) { console.error(err); }
}

onMounted(initMap);
onBeforeUnmount(() => { if (map) map.remove(); });
</script>

<template>
    <div ref="mapContainer" class="w-full h-full bg-slate-100 p-0"></div>
</template>