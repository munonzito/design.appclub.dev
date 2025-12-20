<template>
  <div class="fixed inset-0 flex bg-brand-black overflow-hidden font-sans">
    <ChatSidebar />
    <main class="flex-1 relative">
      <CanvasInfiniteStage />
      
      <!-- Global "AI is designing" indicator -->
      <Transition name="fade">
        <div
          v-if="isDesigning"
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 border-3 border-brand-black bg-brand-lime px-4 py-2 shadow-brutal"
        >
          <div class="h-4 w-4 border-2 border-brand-black rounded-full animate-spin [border-top-color:transparent]"></div>
          <span class="text-sm font-bold text-brand-black">AI is designing...</span>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useProjectState } from '~/composables/useProjectState'

const { isDesigning } = useProjectState()
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>