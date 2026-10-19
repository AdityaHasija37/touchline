import { z } from "zod";
import { MATCH_FORMATS, type MatchFormat } from "@/lib/domain/format";

export const TEAM_COLORS = ["#2f7d4f", "#1d4ed8", "#b91c1c", "#7c3aed", "#c2410c", "#0f766e", "#111827", "#ca8a04"] as const;

export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name needs at least 2 characters.")
    .max(60, "Team name can be at most 60 characters."),
  matchFormat: z.coerce
    .number()
    .refine((n): n is MatchFormat => MATCH_FORMATS.includes(n as MatchFormat), "Choose 5v5, 7v7 or 11v11."),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Choose a team colour.")
    .default(TEAM_COLORS[0]),
});

export type TeamInput = z.infer<typeof teamSchema>;
