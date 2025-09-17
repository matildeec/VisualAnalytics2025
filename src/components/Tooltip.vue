<template>
  <transition name="fade">
    <div v-if="visible" :style="tooltipStyle" class="tooltip">
      <table v-if="contentDict">
        <tr v-for="(value, key) in contentDict" :key="key">
          <td class="tooltip-key">{{ key }}</td>
          <td class="tooltip-value">{{ value }}</td>
        </tr>
      </table>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  x: Number,
  y: Number,
  contentDict: Object,
  visible: Boolean
})

const tooltipStyle = computed(() => ({
  position: 'absolute',       // fixed funziona meglio con SVG e scroll
  left: props.x + 'px',
  top: props.y + 'px',
  background: 'white',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
  padding: '6px 10px',
  pointerEvents: 'none',
  fontSize: '0.75rem',
  color: '#333',
  opacity: props.visible ? 0.95 : 0,
  transition: 'opacity 0.2s ease, transform 0.1s ease',
  whiteSpace: 'nowrap'
}))
</script>

<style scoped>
.tooltip-key {
  color: var(--main-deep-blue);
  font-weight: bold;
  font-size: 0.70rem;
  text-transform: uppercase;
  padding-right: 0.5em;
}
.tooltip-value {
  color: #333;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
