<script setup>
const props = defineProps({
    vessel: { type: String, required: true },
    kind: { type: String, default: '' },
    description: { type: String, default: 'No description available.' },
    activities: { type: Array, default: () => [] },
    species: { type: Array, default: () => [] }
})
</script>

<template>
    <div class="w-64 font-sans p-2 text-slate-800">
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
                    class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold rounded">
                    🐟 {{ s }}
                </span>
            </div>
        </div>
    </div>
</template>