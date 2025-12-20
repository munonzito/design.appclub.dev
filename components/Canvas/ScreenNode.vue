<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Screen } from '~/lib/schemas'
import { useProjectState } from '~/composables/useProjectState'
import { debug } from '~/lib/debug'

const props = defineProps<{
  screen: Screen
}>()

const { editingScreenId } = useProjectState()
const isEditing = computed(() => editingScreenId.value === props.screen.id)

// Tool calls can complete very fast; keep the overlay visible briefly so it's noticeable.
const showEditingOverlay = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

watch(
  isEditing,
  (next) => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }

    if (next) {
      debug.render('editing overlay ON for', props.screen.id)
      showEditingOverlay.value = true
      return
    }

    hideTimer = setTimeout(() => {
      debug.render('editing overlay OFF for', props.screen.id)
      showEditingOverlay.value = false
      hideTimer = null
    }, 900)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})

const looksLikeFullDocument = (rawHtml: string) => {
  const trimmed = rawHtml.trim()
  return /^<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed) || /<body[\s>]/i.test(trimmed)
}

const stripUnsafeOrExternal = (doc: Document) => {
  doc.querySelectorAll('script').forEach(s => s.remove())
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove())
}

const buildSrcdoc = (rawHtml: string, css: string): string => {
  // DOMParser is only available in the browser
  if (!import.meta.client) {
    return ''
  }

  const parser = new DOMParser()

  if (looksLikeFullDocument(rawHtml)) {
    const doc = parser.parseFromString(rawHtml, 'text/html')
    stripUnsafeOrExternal(doc)

    const styleEl = doc.createElement('style')
    styleEl.textContent = css
    ;(doc.head || doc.documentElement).appendChild(styleEl)

    return `<!doctype html>\n${doc.documentElement.outerHTML}`
  }

  // Fragment -> wrap into a full, sandboxed document.
  const doc = parser.parseFromString(
    `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body></body></html>`,
    'text/html',
  )

  const styleEl = doc.createElement('style')
  styleEl.textContent = css
  doc.head.appendChild(styleEl)

  doc.body.innerHTML = rawHtml
  stripUnsafeOrExternal(doc)

  return `<!doctype html>\n${doc.documentElement.outerHTML}`
}

const srcdoc = computed(() => {
  const result = buildSrcdoc(props.screen.html, props.screen.css)
  debug.render('srcdoc for', props.screen.id, {
    htmlLength: props.screen.html?.length || 0,
    cssLength: props.screen.css?.length || 0,
    srcdocLength: result.length,
    srcdocPreview: result.slice(0, 500),
  })
  return result
})

// Force iframe re-render when content changes (some browsers don't update srcdoc reactively)
const iframeKey = computed(() => `${props.screen.id}-${props.screen.html?.length || 0}-${props.screen.css?.length || 0}`)
</script>

<template>
  <div 
    class="absolute" 
    :style="{ left: `${screen.x || 0}px`, top: `${screen.y || 0}px` }"
  >
    <div class="mb-2 flex items-center justify-between">
      <span class="bg-brand-lime px-2 py-1 text-xs font-bold border-2 border-brand-black shadow-[2px_2px_0px_0px_#0F1113]">
        {{ screen.name }}
      </span>
      <span class="text-[10px] text-brand-lime font-mono opacity-50">{{ screen.id }}</span>
    </div>
    <div
      class="relative w-[375px] h-[812px] border-3 shadow-brutal overflow-auto bg-transparent"
      :class="isEditing ? 'border-brand-lime shadow-brutal-lime' : 'border-brand-black'"
    >
      <iframe
        :key="iframeKey"
        class="block w-full h-full bg-transparent"
        style="border: 0"
        :srcdoc="srcdoc"
        sandbox
        referrerpolicy="no-referrer"
      />

      <div
        v-if="showEditingOverlay"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 pointer-events-none"
      >
        <div class="w-[300px] border-3 border-brand-black bg-brand-lime px-4 py-3 shadow-brutal">
          <div class="flex items-center gap-3">
            <div class="h-5 w-5 border-2 border-brand-black bg-brand-lime animate-spin [border-top-color:transparent]"></div>
            <div class="text-sm font-black text-brand-black">Editing…</div>
          </div>
          <div class="mt-1 text-[11px] font-mono text-brand-black/70">
            {{ screen.name }} ({{ screen.id }})
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
