<script setup>
import Button from './Button.vue'
import { getAssetPath } from '../dataManager';
</script>

<template>
    <nav class="sticky top-0 z-50 w-full px-6 py-3 flex items-center justify-between border-b border-white/10 shadow-lg navbar-bg">
        
        <div class="flex items-center select-none">
            <router-link to="/" class="inline-flex items-center gap-3 group focus:outline-none">
                <img 
                    :src="getAssetPath('fisheye-icon.svg')"
                    alt='FishEye icon' 
                    class="w-8 h-8 group-hover:scale-110 transition-transform duration-300" 
                />
                
                <div class="flex flex-col">
                    <span class="text-white font-bold text-lg leading-none tracking-wide">
                        FishEye
                    </span>
                    <span class="text-[10px] text-blue-200 font-medium uppercase tracking-[0.15em] leading-none mt-0.5">
                        International
                    </span>
                </div>
            </router-link>
        </div>

        <div class="flex items-center gap-3">
            <Button
                to="/"
                :icon="getAssetPath('map-icon.svg')"
                label="Traffic Explorer"
            />

            <Button
                to="/harborinspector"
                :icon="getAssetPath('anchor-icon.svg')"
                label="Harbor Inspector"
            />
            
            <Button
                to="/trajectoryanalyzer"
                :icon="getAssetPath('compare-vessel-icon.svg')"
                label="Trajectory Analyzer"
            />
        </div>
    </nav>
</template>

<style scoped>
.navbar-bg {
  background-color: var(--main-deep-blue); 
}
</style>