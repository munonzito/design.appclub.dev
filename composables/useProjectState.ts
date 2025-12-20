import { ref } from 'vue'
import { debug } from '~/lib/debug'

export interface Screen {
  id: string
  name: string
  html: string
  css: string
  x: number
  y: number
}

export interface HistoryItem {
  timestamp: number
  screens: Screen[]
}

// Module-level singleton refs - ensures all components share the same reactive state
const _editingScreenId = ref<string | null>(null)
const _isDesigning = ref(false) // True when upsertScreen tool starts, before we know which screen

export const useProjectState = () => {
  const screens = useState<Screen[]>('project-screens', () => [
    {
      id: 'welcome',
      name: 'Welcome Screen',
      html: `
        <div style="padding: 20px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif;">
          <h1 style="font-size: 24px; margin-bottom: 10px;">Welcome to App Club Design</h1>
          <p style="color: #666;">Ask the AI to design something for you!</p>
        </div>
      `,
      css: '',
      x: 100,
      y: 100
    }
  ])
  const history = useState<HistoryItem[]>('project-history', () => [])

  const upsertScreen = (
    screen: Partial<Screen> & { id: string },
    options?: { skipHistory?: boolean },
  ) => {
    if (!options?.skipHistory) {
      // Save to history before updating
      history.value.push({
        timestamp: Date.now(),
        screens: JSON.parse(JSON.stringify(screens.value))
      })
    }

    const index = screens.value.findIndex(s => s.id === screen.id)
    if (index > -1) {
      screens.value[index] = { ...screens.value[index], ...screen }
    } else {
      // Auto-positioning logic: find right-most screen and place to the right
      const maxX = screens.value.reduce((max, s) => Math.max(max, s.x + 400), 0)
      screens.value.push({
        name: 'Untitled Screen',
        html: '',
        css: '',
        x: maxX + 50,
        y: 50,
        ...screen
      })
    }
  }

  const restoreVersion = (index: number) => {
    if (history.value[index]) {
      screens.value = JSON.parse(JSON.stringify(history.value[index].screens))
    }
  }

  const setEditingScreenId = (id: string | null) => {
    debug.state('editingScreenId =', id)
    _editingScreenId.value = id
  }

  const setIsDesigning = (value: boolean) => {
    debug.state('isDesigning =', value)
    _isDesigning.value = value
  }

  return {
    screens,
    history,
    editingScreenId: _editingScreenId,
    isDesigning: _isDesigning,
    upsertScreen,
    restoreVersion,
    setEditingScreenId,
    setIsDesigning,
  }
}
