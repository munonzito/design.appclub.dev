<script setup lang="ts">
import { Send, Loader2, Download } from 'lucide-vue-next'
import { useChatAgent } from '~/composables/useChatAgent'

const { messages, input, handleSubmit, isLoading } = useChatAgent()

const showExportModal = ref(false)

const scrollRef = ref<HTMLElement | null>(null)

const toolLabel = (tool: any) => {
  const name = tool?.toolName
  const state = tool?.state

  const base = (() => {
    switch (name) {
      case 'upsertScreen':
        return '🧱 Designing screen'
      case 'generateImage':
        return '🖼️ Generating image'
      case 'restoreVersion':
        return '⏪ Restoring version'
      case 'listScreens':
        return '📋 Listing screens'
      case 'getScreen':
        return '🔎 Reading screen'
      default:
        return '⚙️ Working'
    }
  })()

  if (state === 'result') return `${base} — done`
  if (state === 'error') return `${base} — failed`
  return `${base}…`
}

watch(messages, () => {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<template>
  <div class="flex flex-col h-full bg-brand-black border-r-3 border-brand-lime w-[350px]">
    <div class="p-4 border-b-3 border-brand-lime flex items-center justify-between">
      <h1 class="text-brand-lime font-black text-xl tracking-tighter uppercase">App Club Design</h1>
      <button 
        @click="showExportModal = true"
        class="text-brand-lime hover:opacity-70 transition-opacity"
        title="Export screens"
      >
        <Download class="w-5 h-5" />
      </button>
    </div>
    
    <ExportModal :open="showExportModal" @close="showExportModal = false" />

    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="messages.length === 0" class="text-brand-lime/50 text-sm font-medium italic">
        Ask the agent to design a mobile screen or modify an existing one...
      </div>
      
      <div 
        v-for="m in messages" 
        :key="m.id" 
        class="flex flex-col"
        :class="m.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div 
          class="max-w-[85%] p-3 text-sm font-bold border-2"
          :class="m.role === 'user' 
            ? 'bg-brand-lime text-brand-black border-brand-black shadow-brutal' 
            : 'bg-white text-brand-black border-brand-lime shadow-brutal-lime'"
        >
          <div v-if="m.content" class="whitespace-pre-wrap">{{ m.content }}</div>
          <div v-if="m.toolInvocations" class="mt-2 space-y-2">
            <div v-for="tool in m.toolInvocations" :key="tool.toolCallId" class="text-[10px] font-mono opacity-70">
              {{ toolLabel(tool) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t-3 border-brand-lime">
      <form @submit.prevent="handleSubmit" class="relative">
        <input
          v-model="input"
          placeholder="Design a login screen..."
          class="w-full bg-transparent border-3 border-brand-lime p-3 pr-12 text-brand-lime placeholder:text-brand-lime/30 font-bold focus:outline-none focus:ring-2 focus:ring-brand-lime/20 transition-all shadow-brutal-lime active:translate-x-1 active:translate-y-1 active:shadow-none"
        />
        <button 
          type="submit" 
          :disabled="isLoading || !input"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-brand-lime disabled:opacity-30 transition-opacity"
        >
          <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
          <Send v-else class="w-5 h-5" />
        </button>
      </form>
    </div>
  </div>
</template>
