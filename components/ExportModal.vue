<script setup lang="ts">
import { X, Download, Check } from 'lucide-vue-next'
import JSZip from 'jszip'
import { useProjectState, type Screen } from '~/composables/useProjectState'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { screens } = useProjectState()

const selectedIds = ref<Set<string>>(new Set())
const isExporting = ref(false)

const allSelected = computed(() => 
  screens.value.length > 0 && selectedIds.value.size === screens.value.length
)

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(screens.value.map(s => s.id))
  }
}

const toggleScreen = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const generateHtmlFile = (screen: Screen): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${screen.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${screen.css}
  </style>
</head>
<body>
${screen.html}
</body>
</html>`
}

const sanitizeFilename = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const handleExport = async () => {
  if (selectedIds.value.size === 0) return
  
  isExporting.value = true
  
  try {
    const zip = new JSZip()
    const selectedScreens = screens.value.filter(s => selectedIds.value.has(s.id))
    
    for (const screen of selectedScreens) {
      const filename = `${sanitizeFilename(screen.name)}.html`
      const content = generateHtmlFile(screen)
      zip.file(filename, content)
    }
    
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'screens-export.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    emit('close')
  } finally {
    isExporting.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) {
    selectedIds.value = new Set(screens.value.map(s => s.id))
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center">
        <div class="absolute inset-0 bg-black/70" @click="emit('close')" />
        
        <div class="relative bg-brand-black border-3 border-brand-lime shadow-brutal-lime w-full max-w-md mx-4">
          <div class="flex items-center justify-between p-4 border-b-3 border-brand-lime">
            <h2 class="text-brand-lime font-black text-lg uppercase tracking-tight">Export Screens</h2>
            <button @click="emit('close')" class="text-brand-lime hover:opacity-70 transition-opacity">
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <div class="p-4 max-h-[60vh] overflow-y-auto">
            <label class="flex items-center gap-3 p-3 border-2 border-brand-lime cursor-pointer hover:bg-brand-lime/10 transition-colors mb-3">
              <div 
                class="w-5 h-5 border-2 border-brand-lime flex items-center justify-center"
                :class="allSelected ? 'bg-brand-lime' : ''"
                @click.prevent="toggleAll"
              >
                <Check v-if="allSelected" class="w-3 h-3 text-brand-black" />
              </div>
              <span class="text-brand-lime font-bold text-sm">Select All ({{ screens.length }} screens)</span>
            </label>
            
            <div class="space-y-2">
              <label 
                v-for="screen in screens" 
                :key="screen.id"
                class="flex items-center gap-3 p-3 border-2 border-brand-lime/50 cursor-pointer hover:border-brand-lime hover:bg-brand-lime/5 transition-colors"
              >
                <div 
                  class="w-5 h-5 border-2 border-brand-lime flex items-center justify-center flex-shrink-0"
                  :class="selectedIds.has(screen.id) ? 'bg-brand-lime' : ''"
                  @click.prevent="toggleScreen(screen.id)"
                >
                  <Check v-if="selectedIds.has(screen.id)" class="w-3 h-3 text-brand-black" />
                </div>
                <span class="text-brand-lime font-medium text-sm truncate">{{ screen.name }}</span>
              </label>
            </div>
          </div>
          
          <div class="p-4 border-t-3 border-brand-lime">
            <button
              @click="handleExport"
              :disabled="selectedIds.size === 0 || isExporting"
              class="w-full flex items-center justify-center gap-2 bg-brand-lime text-brand-black font-black py-3 px-4 border-3 border-brand-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-brutal"
            >
              <Download v-if="!isExporting" class="w-5 h-5" />
              <div v-else class="w-5 h-5 border-2 border-brand-black rounded-full animate-spin [border-top-color:transparent]" />
              <span>{{ isExporting ? 'Exporting...' : `Export ${selectedIds.size} Screen${selectedIds.size !== 1 ? 's' : ''}` }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
