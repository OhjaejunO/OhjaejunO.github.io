import { getCollection, type CollectionEntry } from 'astro:content';
import { getSeriesMeta, SERIES_META, type SeriesMeta } from '../data/series';

export type BlogPost = CollectionEntry<'blog'>;

/**
 * Load all non-draft blog posts, newest first.
 */
export async function loadPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  posts.sort((a, b) => +b.data.date - +a.data.date);
  return posts;
}

export interface SeriesGroup {
  slug: string;
  meta: SeriesMeta;
  posts: BlogPost[];
  firstPostHref: string;
  latestDate: Date;
}

export interface GroupedPosts {
  series: SeriesGroup[];
  singles: BlogPost[];
}

/**
 * Group posts by their `series` slug. Posts without a series go to `singles`.
 * Series are ordered: registered series first (in SERIES_META declaration order),
 * then unregistered series by their latest post date desc.
 */
export function groupPosts(posts: BlogPost[]): GroupedPosts {
  const seriesMap = new Map<string, BlogPost[]>();
  const singles: BlogPost[] = [];

  for (const post of posts) {
    if (post.data.series) {
      const list = seriesMap.get(post.data.series) ?? [];
      list.push(post);
      seriesMap.set(post.data.series, list);
    } else {
      singles.push(post);
    }
  }

  const seriesGroups: SeriesGroup[] = [];
  for (const [slug, list] of seriesMap.entries()) {
    const sorted = [...list].sort(
      (a, b) => (a.data.seriesPart ?? 0) - (b.data.seriesPart ?? 0)
    );
    const latestDate = sorted.reduce(
      (max, p) => (p.data.date > max ? p.data.date : max),
      sorted[0].data.date
    );
    seriesGroups.push({
      slug,
      meta: getSeriesMeta(slug),
      posts: sorted,
      firstPostHref: `/blog/${sorted[0].id}`,
      latestDate,
    });
  }

  const registeredOrder = Object.keys(SERIES_META).filter((s) =>
    seriesMap.has(s)
  );
  const unregistered = seriesGroups
    .filter((g) => !(g.slug in SERIES_META))
    .sort((a, b) => +b.latestDate - +a.latestDate);

  const orderedSeries: SeriesGroup[] = [
    ...registeredOrder.map((s) => seriesGroups.find((g) => g.slug === s)!),
    ...unregistered,
  ];

  return { series: orderedSeries, singles };
}

/**
 * Within a series, find prev/next neighbors of a post.
 * Returns nulls if the post has no series or is at the boundary.
 */
export function findSeriesNeighbors(
  post: BlogPost,
  allPosts: BlogPost[]
): { prev: BlogPost | null; next: BlogPost | null } {
  if (!post.data.series) return { prev: null, next: null };

  const seriesPosts = allPosts
    .filter((p) => p.data.series === post.data.series)
    .sort((a, b) => (a.data.seriesPart ?? 0) - (b.data.seriesPart ?? 0));

  const idx = seriesPosts.findIndex((p) => p.id === post.id);
  if (idx === -1) return { prev: null, next: null };

  return {
    prev: idx > 0 ? seriesPosts[idx - 1] : null,
    next: idx < seriesPosts.length - 1 ? seriesPosts[idx + 1] : null,
  };
}

/**
 * Format a Date as YYYY.MM.DD using UTC so frontmatter dates render consistently.
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '.');
}
