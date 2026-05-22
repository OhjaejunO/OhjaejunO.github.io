import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

type Category = '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';

export interface PostItem {
  title: string;
  description: string;
  date: string;
  category: Category;
  href: string;
  series?: {
    slug: string;
    name: string;
    part: number;
  };
}

export interface SeriesData {
  number: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  href: string;
  episodeCount: number;
}

interface AllBlogSectionProps {
  posts: PostItem[];
  series: SeriesData[];
}

const CATEGORIES: Category[] = ['회고', 'UE5', '디지털트윈', 'AI', '도구'];

interface PostCardProps {
  post: PostItem;
}

function PostCard({ post }: PostCardProps) {
  return (
    <motion.a
      href={post.href}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="group flex flex-col h-full bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-7 hover:border-[#2a2a2a] transition-colors duration-300"
    >
      <div className="flex items-center justify-between mb-4 md:mb-5">
        <time
          dateTime={post.date}
          className="text-[#646973] tabular-nums uppercase tracking-[0.2em] text-[10px] md:text-xs"
        >
          {post.date}
        </time>
        <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs">
          {post.category}
        </span>
      </div>

      <h3
        className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.2] mb-3 md:mb-4 group-hover:translate-x-1 transition-transform duration-300"
        style={{ fontSize: 'clamp(1.125rem, 1.8vw, 1.5rem)' }}
      >
        {post.title}
      </h3>

      <p
        className="text-[#9aa5af] font-light leading-relaxed mb-5 md:mb-6"
        style={{ fontSize: 'clamp(0.9375rem, 1vw, 1.0625rem)' }}
      >
        {post.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3">
        {post.series ? (
          <span
            className="inline-flex items-center gap-2 text-[#9aa5af] uppercase tracking-[0.18em] text-[10px] md:text-[11px] border border-[#2a2a2a] rounded-full px-2.5 py-1 truncate"
            title={`${post.series.name} #${post.series.part}`}
          >
            <span className="text-[#646973]">Series</span>
            <span className="text-[#646973]">·</span>
            <span className="truncate">{post.series.name}</span>
            <span className="text-[#646973] tabular-nums">
              #{post.series.part}
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-2 text-[#D7E2EA] uppercase tracking-wider text-[11px] md:text-xs group-hover:opacity-70 transition-opacity duration-200 shrink-0">
          Read
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </motion.a>
  );
}

interface SeriesCardProps {
  series: SeriesData;
}

function SeriesCard({ series }: SeriesCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.a
      href={series.href}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="group flex flex-col h-full bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-8 hover:border-[#2a2a2a] transition-colors duration-300"
    >
      <div className="flex items-start justify-between mb-5 md:mb-6">
        <span
          className="text-[#646973] font-light tabular-nums"
          style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)' }}
        >
          {series.number}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs">
            {series.category}
          </span>
          <span className="text-[#9aa5af] tabular-nums text-[10px] md:text-xs border border-[#2a2a2a] rounded-full px-2.5 py-1">
            {series.episodeCount} {series.episodeCount > 1 ? 'posts' : 'post'}
          </span>
        </div>
      </div>

      <motion.h3
        animate={{ x: hovered ? 8 : 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.1] mb-3 md:mb-4"
        style={{ fontSize: 'clamp(1.25rem, 2.2vw, 1.875rem)' }}
      >
        {series.name}
      </motion.h3>

      <p
        className="text-[#9aa5af] font-light leading-relaxed mb-6 md:mb-8"
        style={{ fontSize: 'clamp(0.9375rem, 1vw, 1.0625rem)' }}
      >
        {series.description}
      </p>

      <div className="mt-auto flex items-center justify-end">
        <span
          className="inline-flex items-center gap-3 text-[#D7E2EA] uppercase tracking-wider border-b border-[#D7E2EA] pb-1 group-hover:border-[#9aa5af] group-hover:text-[#9aa5af] transition-colors duration-200"
          style={{ fontSize: 'clamp(0.8125rem, 0.95vw, 0.9375rem)' }}
        >
          Read Series
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </motion.a>
  );
}

export default function AllBlogSection({ posts, series }: AllBlogSectionProps) {
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  const filteredPosts = useMemo(
    () =>
      activeCategory === 'ALL'
        ? posts
        : posts.filter((p) => p.category === activeCategory),
    [posts, activeCategory]
  );

  const filteredSeries = useMemo(
    () =>
      activeCategory === 'ALL'
        ? series
        : series.filter((s) => s.category === activeCategory),
    [series, activeCategory]
  );

  return (
    <section className="relative w-full px-6 md:px-12 lg:px-24 pt-16 md:pt-24 pb-20 md:pb-28">
      <div className="w-full max-w-7xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="text-[#646973] uppercase tracking-[0.3em] text-xs md:text-sm mb-6 md:mb-10"
        >
          / Journal
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-black uppercase tracking-tight leading-[0.95] text-[#D7E2EA] mb-6 md:mb-8"
          style={{ fontSize: 'clamp(2.75rem, 10vw, 8.5rem)' }}
        >
          Blog
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-[#9aa5af] font-light leading-relaxed max-w-2xl mb-12 md:mb-16"
          style={{ fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
        >
          UE5 게임 개발, 디지털 트윈 작업 일지, AI 워크플로우 실험. 시리즈
          단위로 묶어 쌓아온 긴 글, 단편 글, 그리고 모음입니다.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap items-center gap-2 md:gap-3 mb-10 md:mb-14"
        >
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`text-[11px] md:text-xs uppercase tracking-wide rounded-full px-3 py-1.5 border transition-colors duration-200 ${
              activeCategory === 'ALL'
                ? 'text-[#0C0C0C] bg-[#D7E2EA] border-[#D7E2EA]'
                : 'text-[#9aa5af] border-[#1f1f1f] hover:border-[#2a2a2a] hover:text-[#D7E2EA]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-[11px] md:text-xs uppercase tracking-wide rounded-full px-3 py-1.5 border transition-colors duration-200 ${
                activeCategory === cat
                  ? 'text-[#0C0C0C] bg-[#D7E2EA] border-[#D7E2EA]'
                  : 'text-[#9aa5af] border-[#1f1f1f] hover:border-[#2a2a2a] hover:text-[#D7E2EA]'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {filteredPosts.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-5 md:gap-6 lg:gap-8">
            {filteredPosts.map((p) => (
              <PostCard key={p.href} post={p} />
            ))}
          </div>
        ) : (
          <div className="bg-[#141414] border border-dashed border-[#1f1f1f] rounded-2xl p-8 md:p-12 text-center">
            <p
              className="text-[#9aa5af] font-light leading-relaxed"
              style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)' }}
            >
              아직 글이 없습니다.
            </p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mt-20 md:mt-28"
        >
          <div className="flex items-end justify-between mb-6 md:mb-8 border-b border-[#1f1f1f] pb-4 md:pb-5">
            <h2
              className="font-light uppercase tracking-tight text-[#D7E2EA]"
              style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)' }}
            >
              Series
            </h2>
            <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs">
              시리즈로 묶어보기 · {filteredSeries.length}
            </span>
          </div>

          {filteredSeries.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {filteredSeries.map((s) => (
                <SeriesCard key={s.slug} series={s} />
              ))}
            </div>
          ) : (
            <div className="bg-[#141414] border border-dashed border-[#1f1f1f] rounded-2xl p-8 md:p-12 text-center">
              <p
                className="text-[#9aa5af] font-light leading-relaxed"
                style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)' }}
              >
                아직 시리즈가 없습니다. 첫 글을 곧 추가합니다.
              </p>
            </div>
          )}
        </motion.div>

        <div className="mt-16 md:mt-24 flex justify-between items-center">
          <a
            href="/"
            className="group/back inline-flex items-center gap-3 text-[#D7E2EA] uppercase tracking-wider hover:opacity-70 transition-opacity duration-200"
            style={{ fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/back:-translate-x-1"
            >
              ←
            </span>
            Back to Home
          </a>

          <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs tabular-nums">
            {series.length} series · {posts.length} posts
          </span>
        </div>
      </div>
    </section>
  );
}
