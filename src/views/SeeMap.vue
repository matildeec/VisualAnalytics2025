<script setup>
import Map from '../components/d3/Map.vue'

</script>

<template>
    <div class="h-full flex flex-col overflow-hidden bg-gray-100">
        
        <div class="m-8 mt-4 pb-4 flex-col flex lg:flex-row items-start lg:items-center gap-2 mb-2 min-h-12 border-b-2 border-gray-200">
        <h1 class="text-lg font-bold tracking-tight uppercase">Oceanus Map</h1>
        <span class="flex text-xs text-gray-400 gap-2 flex-end">
            <img src="../assets/icon-info.svg" alt="info" class="w-4 h-4 inline-block" />
            Explore global vessel movements and harbor activities through an interactive map interface.
        </span>
        </div>

        <div class="flex-grow p-4 flex flex-col gap-2 overflow-hidden">
            <Map />
        </div>
    </div>
</template>