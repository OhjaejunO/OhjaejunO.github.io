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

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    category: z.string(),
    badgeCategory: z.string(),
    order: z.number(),

    period: z.string(),
    role: z.string(),
    teamSize: z.string(),
    status: z.enum(['완료', '진행 중', 'Live']),
    isTeamProject: z.boolean(),

    techStack: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    ),
    badges: z.array(z.string()),

    links: z.object({
      github: z.string().optional(),
      githubLabel: z.string().optional(),
      blog: z.string().optional(),
      blogLabel: z.string().optional(),
      demo: z.string().optional(),
      live: z.string().optional(),
    }),

    keyFeatures: z.array(z.string()),
    keyLearnings: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          blogLink: z.string().optional(),
        })
      )
      .optional(),

    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };
