import { tool } from 'ai'
import { z } from 'zod'

const isDebug = process.env.NODE_ENV !== 'production'

const preview = (value: unknown, max = 400) => {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (str.length <= max) return str
  return `${str.slice(0, max)}…(+${str.length - max} chars)`
}

interface CreateToolsOptions {
  screens: unknown
  onUpsertInputDelta?: (toolCallId: string, delta: string) => void
}

export const createTools = ({ screens, onUpsertInputDelta }: CreateToolsOptions) => ({
  listScreens: tool({
    description: 'Returns a list of all existing screens (id and name).',
    inputSchema: z.object({}),
    execute: async () => {
      const screenList = Array.isArray(screens) ? screens : []
      return {
        screens: screenList.map((s: any) => ({ id: s?.id, name: s?.name })),
      }
    },
  }),

  getScreen: tool({
    description: 'Returns the full HTML/CSS for a specific screen by id.',
    inputSchema: z.object({
      id: z.string(),
    }),
    execute: async ({ id }) => {
      const screenList = Array.isArray(screens) ? screens : []
      const screen = screenList.find((s: any) => s?.id === id)

      if (!screen) {
        return { found: false }
      }

      return {
        found: true,
        screen: {
          id: screen.id,
          name: screen.name,
          html: screen.html,
          css: screen.css,
        },
      }
    },
  }),

  upsertScreen: tool({
    description: 'Create or update a design screen with HTML and CSS.',
    inputSchema: z.object({
      id: z.string().describe('Unique identifier for the screen (e.g., login-page)'),
      name: z.string().describe('Human readable name for the screen'),
      html: z.string().describe('The vanilla HTML for the screen UI'),
      css: z.string().describe('The CSS for the screen UI. Use descriptive classes.'),
    }),
    onInputDelta: ({ inputTextDelta, toolCallId }) => {
      if (onUpsertInputDelta) {
        onUpsertInputDelta(toolCallId, inputTextDelta)
      }
    },
    execute: async ({ id, name, html, css }) => {
      if (isDebug) {
        console.log('[ai-tools] upsertScreen input', {
          id,
          name,
          htmlLength: html.length,
          cssLength: css.length,
          htmlStartsWithDoctype: /^\s*<!doctype/i.test(html),
          htmlHasHtmlTag: /<html[\s>]/i.test(html),
          htmlHasBodyTag: /<body[\s>]/i.test(html),
          htmlHasStyleTag: /<style[\s>]/i.test(html),
          cssPreview: preview(css),
          htmlPreview: preview(html),
        })
      }

      // In a real scenario, we might want to update a DB here
      // But for this project, we'll return the data to be handled by the frontend
      return { id, name, html, css }
    },
  }),
  generateImage: tool({
    description: 'Generate an AI image for a UI asset (logo, icon, background).',
    inputSchema: z.object({
      prompt: z.string().describe('Descriptive prompt for the image generation'),
    }),
    execute: async ({ prompt }) => {
      if (isDebug) console.log('[ai-tools] generateImage input', { prompt: preview(prompt, 200) })
      // This will be called via experimental_generateImage in the future
      // For now, return a placeholder or mock
      return { 
        url: `https://placehold.co/600x400/0F1113/D1FE17?text=${encodeURIComponent(prompt)}`,
      }
    },
  }),
  restoreVersion: tool({
    description: 'Restore a previous version of the project state.',
    inputSchema: z.object({
      index: z.number().describe('The index of the history item to restore'),
    }),
    execute: async ({ index }) => {
      if (isDebug) console.log('[ai-tools] restoreVersion input', { index })
      return { index }
    },
  }),
})
