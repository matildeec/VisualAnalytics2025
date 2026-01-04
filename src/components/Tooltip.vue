<script setup>
import { computed } from 'vue'

const props = defineProps({
  x: Number,
  y: Number,
  contentDict: Object,
  visible: Boolean,
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'warning', 'danger'].includes(value)
  }
})

const positionStyle = computed(() => ({
  position: 'fixed',
  left: props.x + 'px',
  top: props.y + 'px',
  zIndex: 9999,
  pointerEvents: 'none'
}))

const variantClass = computed(() => `tooltip-${props.variant}`)
</script>

<template>
  <transition name="fade">
    <div v-if="visible" :style="positionStyle" class="tooltip-box" :class="variantClass">
      <table v-if="contentDict">
        <tr v-for="(value, key) in contentDict" :key="key">
          <td class="tooltip-key">{{ key }}</td>
          <td class="tooltip-value">{{ value }}</td>
        </tr>
      </table>
    </div>
  </transition>
</template>

<style scoped>
/* Base styles for the box */
.tooltip-box {
  border-radius: 6px;
  box-shadow: 0px 4px 12px rgba(0,0,0,0.15);
  padding: 8px 12px;
  font-size: 0.75rem;
  white-space: nowrap;
  transition: opacity 0.2s ease, transform 0.1s ease;
}

/* --- Default Theme (White/Blue) --- */
.tooltip-default {
  background: white;
  border: 1px solid #ccc;
  color: #333;
}
.tooltip-default .tooltip-key {
  color: var(--main-deep-blue, #0056b3); /* Fallback color added */
}

/* --- warning Theme (Yellow) --- */
.tooltip-warning {
  background: #fffbeb; /* Very light yellow background */
  border: 2px solid #f59e0b; /* Strong yellow border */
  color: #78350f; /* Dark yellow text */
}
.tooltip-warning .tooltip-key {
  color: #d97706; 
}

/* --- Danger Theme (Red) --- */
.tooltip-danger {
  background: #fef2f2; /* Very light red background */
  border: 2px solid #ef4444; /* Strong red border */
  color: #7f1d1d; /* Dark red text */
}
.tooltip-danger .tooltip-key {
  color: #dc2626; 
}

.tooltip-key {
  font-weight: bold;
  font-size: 0.70rem;
  text-transform: uppercase;
  padding-right: 0.8em;
  text-align: right;
}
.tooltip-value {
  font-weight: 500;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>