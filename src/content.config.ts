import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['회고', 'UE5', '디지털트윈', 'AI', '도구']),
    series: z.string().optional(),
    seriesPart: z.number().int().positive().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    originalUrl: z.string().url().optional(),
    heroImage: z.string().optional(),
  }),
});

export const collections = { blog };
