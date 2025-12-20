<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useProjectState } from '~/composables/useProjectState'

const { screens } = useProjectState()
const transform = ref({ x: 0, y: 0, scale: 1 })

const clampScale = (scale: number) => Math.min(Math.max(0.1, scale), 5)

const zoomIn = () => {
  transform.value.scale = clampScale(transform.value.scale * 1.1)
}

const zoomOut = () => {
  transform.value.scale = clampScale(transform.value.scale / 1.1)
}

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) { // Zoom
    const zoomSpeed = 0.001
    const newScale = transform.value.scale - e.deltaY * zoomSpeed
    transform.value.scale = clampScale(newScale)
  } else { // Pan
    transform.value.x -= e.deltaX
    transform.value.y -= e.deltaY
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return

  if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomIn()
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomOut()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    class="relative w-full h-full overflow-hidden bg-[#1e1e1e] cursor-grab active:cursor-grabbing"
    @wheel.prevent="handleWheel"
  >
    <div class="absolute right-4 top-4 z-20 flex items-center gap-2">
      <div class="bg-brand-black/70 text-brand-lime text-[10px] font-mono px-2 py-1 border border-brand-lime">
        {{ Math.round(transform.scale * 100) }}%
      </div>
      <button
        type="button"
        class="bg-brand-lime text-brand-black font-black border-2 border-brand-black shadow-brutal px-3 py-2 leading-none"
        @click.stop="zoomOut"
        title="Zoom out (Ctrl/Cmd -)"
      >
        −
      </button>
      <button
        type="button"
        class="bg-brand-lime text-brand-black font-black border-2 border-brand-black shadow-brutal px-3 py-2 leading-none"
        @click.stop="zoomIn"
        title="Zoom in (Ctrl/Cmd +)"
      >
        +
      </button>
    </div>

    <!-- Grid background -->
    <div 
      class="absolute inset-0 pointer-events-none opacity-10"
      :style="{
        backgroundImage: 'radial-gradient(#D1FE17 1px, transparent 1px)',
        backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`
      }"
    ></div>

    <div 
      class="absolute transition-transform duration-75 ease-out"
      :style="{ 
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        transformOrigin: '0 0'
      }"
    >
      <!-- ClientOnly: ScreenNode uses DOMParser which is browser-only -->
      <ClientOnly>
        <CanvasScreenNode 
          v-for="s in screens" 
          :key="s.id" 
          :screen="s" 
        />
      </ClientOnly>
    </div>
  </div>
</template>
