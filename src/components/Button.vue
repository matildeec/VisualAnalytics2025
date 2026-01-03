<script setup>
defineProps({
    to: { type: String, required: true },
    icon: { type: String, required: true },
    label: { type: String, required: true }
})
</script>

<template>
    <router-link :to="to" class="btn-glass group">
        <img 
            :src="icon" 
            :alt="label + ' icon'" 
            class="w-3.5 h-3.5 transition-opacity duration-200 opacity-60 group-hover:opacity-100 group-[.router-link-active]:opacity-100" 
        />
        
        <span class="font-medium tracking-wide relative z-10">{{ label }}</span>
    </router-link>
</template>

<style scoped>
.btn-glass {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 9999px;
    
    font-size: 12px;
    text-transform: uppercase; 
    text-decoration: none;
    font-weight: 600;
    
    color: #94a3b8;
    background-color: #ffffff08;
    border: 1px solid #ffffff0d;
    backdrop-filter: blur(4px);
    
    transition: all 0.2s ease-out;
}

.btn-glass:hover {
    color: #ffffff;
    background-color: #ffffff1a;
    border-color: #ffffff33;
    transform: translateY(-1px);
}

.btn-glass.router-link-active {
    color: #ffffff;
    background-color: #ffffff26;
    border-color: #ffffff80;
    box-shadow: 0 0 12px #ffffff1a;
}
</style>