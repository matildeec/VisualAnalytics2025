<script setup>
import { ref, onMounted } from 'vue'
import { getCommodityStatus, getFishIcon, commodityStyles } from './d3/utils.js';

const props = defineProps({
    vessel: { type: String, required: true },
    kind: { type: String, default: '' },
    description: { type: String, default: '' },
    activities: { type: Array, default: () => [] },
    species: { type: Array, default: () => [] }
})

const speciesInfoMap = ref(new Map())

// Get species data (status and icon) from the map
const getSpeciesData = (speciesName) => {
    return speciesInfoMap.value.get(speciesName) || { status: 'legal', icon: 'fish-icon-default.svg' };
}

// Get CSS classes based on species status (legal, suspect, illegal)
const getStatusClasses = (speciesName) => {
    const { status } = getSpeciesData(speciesName);
    return commodityStyles[status] || commodityStyles['legal'];
}

onMounted(async () => {
    try {
        const response = await fetch('/data/commodities.json')
        const allCommodities = await response.json()

        const map = new Map();
        
        allCommodities.forEach(c => {
            const status = getCommodityStatus(c.id);            
            const iconFile = getFishIcon(c.id);

            map.set(c.name, {
                status: status,
                icon: iconFile
            });
        });
        
        speciesInfoMap.value = map;
    } catch (err) {
        console.error("Error loading commodities:", err)
    }
})
</script>

<template>
    <div class="w-full font-sans text-slate-800">
        <div class="mb-2 border-b border-slate-200 pb-1">
            <h3 class="text-sm font-black uppercase leading-tight">{{ vessel }}</h3>
            <span v-if="kind" class="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{{ kind }}</span>
        </div>

        <p v-if="description" class="text-[11px] text-slate-600 leading-snug mb-3 italic">{{ description }}</p>

        <div v-if="activities.length" class="mb-3">
            <h4 class="text-[8px] font-bold text-slate-400 uppercase mb-1">Activities</h4>
            <div class="flex flex-wrap gap-1">
                <span v-for="act in activities" :key="act" 
                    class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                    {{ act }}
                </span>
            </div>
        </div>

        <div v-if="species && species.length">
            <h4 class="text-[8px] font-bold text-slate-400 uppercase mb-1">Endemic Species</h4>
            <div class="flex flex-wrap gap-1">
                <span v-for="s in species" :key="s" 
                    class="pl-1 pr-2 py-0.5 text-[9px] font-bold rounded border transition-all duration-300 flex items-center gap-1.5"
                    :class="getStatusClasses(s)"
                >
                    <img 
                        :src="`../src/assets/${getSpeciesData(s).icon}`" 
                        alt="fish"
                        class="w-3.5 h-3.5 object-contain opacity-80"
                    />
                    
                    <span>{{ s }}</span>
                </span>
            </div>
        </div>
    </div>
</template>