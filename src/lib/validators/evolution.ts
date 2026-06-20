import { z } from "zod";

export const evolutionWebhookSchema = z.object({
  event: z.string().min(1),
  instance: z.string().min(1).optional(),
  data: z.object({
    key: z.object({
      id: z.string().min(1).optional(),
      remoteJid: z.string().min(5),
      fromMe: z.boolean().default(false)
    }),
    pushName: z.string().optional(),
    profilePictureUrl: z.string().optional(),
    profilePicUrl: z.string().optional(),
    picture: z.string().optional(),
    message: z.record(z.string(), z.unknown()).optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.number().optional()
  }).passthrough()
}).passthrough();

export const handoffSchema = z.object({
  reason: z.string().max(300).optional()
});

export type EvolutionWebhookInput = z.infer<typeof evolutionWebhookSchema>;
