/**
 * Design Agent Configuration
 * 
 * Creates an AI agent specialized for UI/UX design tasks.
 * Uses the AI SDK Experimental Agent class with tool calling.
 * 
 * Supports multiple providers via AI_PROVIDER env variable:
 * - "azure" (default): Azure OpenAI
 * - "openrouter": OpenRouter (access to 100+ models)
 * 
 * @see https://ai-sdk.dev/docs/agents/building-agents
 */

import { createAzure } from '@ai-sdk/azure'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Experimental_Agent as Agent, stepCountIs } from 'ai'
import type { ToolSet, LanguageModelV2 } from 'ai'

/**
 * System prompt that defines the agent's behavior and capabilities.
 * Keep this separate for easy iteration and A/B testing.
 */
export const DESIGN_AGENT_SYSTEM_PROMPT = `You are a professional UI/UX Design Agent.
Your goal is to help users design mobile and desktop application screens.

Rules:
- Do not answer the user with code. Only use code when calling tools.
- When modifying an existing screen, first call 'listScreens' and/or 'getScreen' to confirm the target ID and current HTML/CSS.

When a user asks for a design:
1. Use 'upsertScreen' to create or update the HTML/CSS.
2. Use vanilla HTML and CSS. You can use modern CSS features.
3. Design the screen exactly as the user requests - match their specified style, colors, and aesthetic.
4. If no specific style is mentioned, create clean, modern, professional designs.

Always be helpful and creative. Focus on delivering what the user asked for.`

/**
 * Get the configured AI model based on environment variables.
 * 
 * Environment variables:
 * - AI_PROVIDER: "azure" | "openrouter" (default: "azure")
 * - AI_MODEL: Model name (default depends on provider)
 * - AZURE_API_KEY: Required for Azure provider
 * - OPENROUTER_API_KEY: Required for OpenRouter provider
 */
function getModel(): LanguageModelV2 {
  const provider = process.env.AI_PROVIDER || 'azure'
  
  if (provider === 'openrouter') {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    const model = process.env.AI_MODEL || 'anthropic/claude-sonnet-4'
    return openrouter.chat(model)
  }
  
  // Default: Azure
  const azure = createAzure({
    baseURL: 'your_base_url_here',
    apiKey: process.env.AZURE_API_KEY,
  })
  const model = process.env.AI_MODEL || 'gpt-5.1'
  return azure(model)
}

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
    model: getModel(),
    system: DESIGN_AGENT_SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(DESIGN_AGENT_MAX_STEPS),
  })
}
