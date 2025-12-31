
<script setup>
import Navbar from './components/Navbar.vue'
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <Navbar class="shrink-0" /> 
    <router-view class="flex-1 overflow-hidden" /> </div>
</template>
