import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

/**
 * Load all non-draft projects, sorted by `order` ascending.
 */
export async function loadPublishedProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) => !data.draft);
  projects.sort((a, b) => a.data.order - b.data.order);
  return projects;
}

/**
 * Find prev/next neighbors of a project by order.
 */
export function findProjectNeighbors(
  currentSlug: string,
  allProjects: Project[]
): { prev: Project | null; next: Project | null } {
  const idx = allProjects.findIndex((p) => p.id === currentSlug);
  if (idx === -1) return { prev: null, next: null };

  return {
    prev: idx > 0 ? allProjects[idx - 1] : null,
    next: idx < allProjects.length - 1 ? allProjects[idx + 1] : null,
  };
}
