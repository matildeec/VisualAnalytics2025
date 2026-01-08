<script setup>
import { ref, computed, watch, nextTick } from 'vue'

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

// DOM reference
const tooltipRef = ref(null)

// Logical position after adjustments
const adjustedPos = ref({ x: 0, y: 0 })

// Offset configuration
const OFFSET = 15
const PADDING = 10

const calculatePosition = async () => {
  await nextTick()

  if (!props.visible || !tooltipRef.value) return  

  const el = tooltipRef.value
  const rect = el.getBoundingClientRect()
  
  const winW = window.innerWidth
  const winH = window.innerHeight

  // Default position (bottom-right of cursor)
  let left = props.x + OFFSET
  let top = props.y + OFFSET

  // --- LOGICA "SMART" ---
  
  // If it goes BEYOND the RIGHT edge, place it to the LEFT of the cursor
  if (left + rect.width > winW - PADDING) {
    left = props.x - rect.width - OFFSET
  }

  // If it goes BEYOND the BOTTOM, place it above the cursor
  if (top + rect.height > winH - PADDING) {
    top = props.y - rect.height - OFFSET
  }

  // Never go beyond the window edges
  if (left < PADDING) left = PADDING
  if (top < PADDING) top = PADDING

  adjustedPos.value = { x: left, y: top }
}

// Calculates position on prop changes
watch(
  () => [props.x, props.y, props.visible, props.contentDict], 
  calculatePosition,
  { immediate: true }
)

// Stile dinamico basato sulle coordinate calcolate
const positionStyle = computed(() => ({
  position: 'fixed',
  left: `${adjustedPos.value.x}px`,
  top: `${adjustedPos.value.y}px`,
  zIndex: 9999,
  pointerEvents: 'none' // Avoids flickering
}))

const variantClass = computed(() => `tooltip-${props.variant}`)
</script>

<template>
  <transition name="fade">
    <div 
      v-if="visible" 
      ref="tooltipRef" 
      :style="positionStyle" 
      class="tooltip-box" 
      :class="variantClass"
    >
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
  transition: opacity 0.1s ease; 
}

/* --- Default Theme (White/Blue) --- */
.tooltip-default {
  background: white;
  border: 1px solid #ccc;
  color: #333;
}
.tooltip-default .tooltip-key {
  color: var(--main-deep-blue, #0056b3);
}

/* --- warning Theme (Yellow) --- */
.tooltip-warning {
  background: #fffbeb;
  border: 2px solid #f59e0b;
  color: #78350f;
}
.tooltip-warning .tooltip-key {
  color: #d97706; 
}

/* --- Danger Theme (Red) --- */
.tooltip-danger {
  background: #fef2f2;
  border: 2px solid #ef4444;
  color: #7f1d1d;
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