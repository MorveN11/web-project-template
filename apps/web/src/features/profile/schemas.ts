import { z } from 'zod';

export const profileFormSchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  email: z.email().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
