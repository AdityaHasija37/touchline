import { z } from "zod";

export const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const playerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the player's name.")
    .max(60, "Names can be at most 60 characters."),
  shirtNumber: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce
      .number({ message: "Shirt number must be a number." })
      .int("Shirt number must be a whole number.")
      .min(0, "Shirt numbers run from 0 to 99.")
      .max(99, "Shirt numbers run from 0 to 99.")
      .nullable(),
  ),
  preferredPositions: z
    .array(z.enum(POSITIONS))
    .max(POSITIONS.length)
    .transform((list) => [...new Set(list)])
    .default([]),
});

export type PlayerInput = z.infer<typeof playerSchema>;
