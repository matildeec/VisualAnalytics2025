<script setup>
defineProps({
    loading: {
        type: Boolean,
        required: true
    },
    message: {
        type: String,
        default: 'Loading Visualization...'
    }
})
</script>

<template>
    <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
        <div 
            v-if="loading" 
            class="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center backdrop-blur-sm"
        >
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mb-3"></div>
            
            <div class="text-sm font-medium text-gray-600 animate-pulse">
                {{ message }}
            </div>
        </div>
    </Transition>
</template>