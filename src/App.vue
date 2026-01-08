
<script setup>
import Navbar from './components/Navbar.vue'
</script>

<!-- keep-alive avoids view destruction for better user-flow -->
<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <Navbar class="shrink-0" />
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" class="flex-1 overflow-hidden" />
      </keep-alive>
    </router-view>
  </div>
</template>