import { z } from 'zod'

export const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  html: z.string(),
  css: z.string(),
  x: z.number().optional(),
  y: z.number().optional()
})

export type Screen = z.infer<typeof ScreenSchema>
