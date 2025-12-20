/**
 * Design Agent Configuration
 * 
 * Creates an AI agent specialized for UI/UX design tasks.
 * Uses the AI SDK Experimental Agent class with tool calling.
 * 
 * @see https://ai-sdk.dev/docs/agents/building-agents
 */

import { createAzure } from '@ai-sdk/azure'
import { Experimental_Agent as Agent, stepCountIs } from 'ai'
import type { ToolSet } from 'ai'

/**
 * System prompt that defines the agent's behavior and capabilities.
 * Keep this separate for easy iteration and A/B testing.
 */
export const DESIGN_AGENT_SYSTEM_PROMPT = `You are a professional UI/UX Design Agent for "App Club Design".
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
Always try to be helpful and creative.`

/**
 * Azure OpenAI configuration.
 * Uses environment variables for API key.
 */
const azure = createAzure({
  baseURL: 'https://munon-m6zg3vf1-eastus2.cognitiveservices.azure.com/openai/',
  apiKey: process.env.AZURE_API_KEY,
})

/** Default model for the design agent */
export const DESIGN_AGENT_MODEL = azure('gpt-5.1')

/** Maximum number of tool-calling steps before stopping */
export const DESIGN_AGENT_MAX_STEPS = 10

/**
 * Creates a design agent instance with the provided tools.
 * 
 * @param tools - The tool set for the agent (from createTools)
 * @returns An Agent instance ready to stream or generate
 * 
 * @example
 * ```ts
 * const tools = createTools({ screens, onUpsertInputDelta })
 * const agent = createDesignAgent(tools)
 * const result = agent.stream({ messages })
 * ```
 */
export function createDesignAgent(tools: ToolSet) {
  return new Agent({
    model: DESIGN_AGENT_MODEL,
    system: DESIGN_AGENT_SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(DESIGN_AGENT_MAX_STEPS),
  })
}
