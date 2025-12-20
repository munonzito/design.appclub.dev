import { createAzure } from '@ai-sdk/azure';
import { Experimental_Agent as Agent, stepCountIs, validateUIMessages, createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from 'ai'
import { createTools } from '../utils/ai-tools'

const isDebug = process.env.NODE_ENV !== 'production'

const extractText = (message: any) => {
  const parts = Array.isArray(message?.parts) ? message.parts : []
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('')
}

const azure = createAzure({
  baseURL: 'https://munon-m6zg3vf1-eastus2.cognitiveservices.azure.com/openai/',
  apiKey: process.env.AZURE_API_KEY
});

export default defineEventHandler(async (event) => {
  const { messages, screens } = await readBody(event)

  if (isDebug) {
    const last = Array.isArray(messages) ? messages[messages.length - 1] : undefined
    const text = extractText(last)
    console.log('[api/chat] request', {
      messageCount: Array.isArray(messages) ? messages.length : null,
      lastRole: last?.role,
      lastTextPreview: text ? `${text.slice(0, 300)}${text.length > 300 ? '…' : ''}` : '',
    })
  }

  const validated = await validateUIMessages({ messages })

  if (isDebug) {
    console.log('[api/chat] validated', {
      messageCount: validated.length,
    })
  }

  // Track partial input for upsertScreen to extract ID early
  const upsertInputBuffers = new Map<string, string>()
  const sentEditingStart = new Set<string>()

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const agent = new Agent({
        model: azure('gpt-5.1'),
        system: `You are a professional UI/UX Design Agent for "Gemini Canvas".
Your goal is to help users design mobile and desktop screens.

Rules:
- Do not answer the user with code. Only use code when calling tools.
- When modifying an existing screen, first call 'listScreens' and/or 'getScreen' to confirm the target ID and current HTML/CSS.

When a user asks for a design:
1. Use 'upsertScreen' to create or update the HTML/CSS.
2. Use vanilla HTML and CSS. You can use modern CSS features.
3. Ensure the design is responsive and looks professional.
4. If you need an image, call 'generateImage' first, get the URL, then use it in the HTML.

The branding of the tool itself is Neobrutalism (Black #0F1113, Lime #D1FE17), but the screens you design should be what the user requests (often clean, modern, etc.).
Always try to be helpful and creative.`,
        tools: createTools({ 
          screens, 
          onUpsertInputDelta: (toolCallId: string, delta: string) => {
            // Accumulate the input text
            const current = upsertInputBuffers.get(toolCallId) || ''
            const updated = current + delta
            upsertInputBuffers.set(toolCallId, updated)

            // Try to extract the ID from partial JSON
            // Pattern: "id": "some-value" or "id":"some-value"
            if (!sentEditingStart.has(toolCallId)) {
              const idMatch = updated.match(/"id"\s*:\s*"([^"]+)"/)
              if (idMatch) {
                const screenId = idMatch[1]
                sentEditingStart.add(toolCallId)
                
                if (isDebug) {
                  console.log('[api/chat] extracted screen ID from partial input:', screenId)
                }

                // Send custom event to client
                writer.write({
                  type: 'data-editing-start',
                  data: { screenId, toolCallId },
                  transient: true,
                })
              }
            }
          }
        }),
        stopWhen: stepCountIs(10),
      })

      // Use agent.stream() which returns a streamable result
      // Agent.stream() expects ModelMessage[], so we convert from UIMessage[]
      const modelMessages = convertToModelMessages(validated)
      const result = agent.stream({ messages: modelMessages })
      writer.merge(result.toUIMessageStream())
    },
  })

  return createUIMessageStreamResponse({ stream })
})
