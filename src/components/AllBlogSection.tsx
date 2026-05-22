import { motion } from 'framer-motion';
import { useState } from 'react';

type Category = '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';

interface Episode {
  title: string;
  href: string;
}

export interface SeriesData {
  number: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  href: string;
  episodes: Episode[];
}

export interface SingleData {
  title: string;
  description: string;
  date: string;
  category: Category;
  href: string;
}

interface AllBlogSectionProps {
  series: SeriesData[];
  singles: SingleData[];
}

interface SeriesCardProps {
  series: SeriesData;
  activeCategory: Category | 'ALL';
}

function SeriesCard({ series, activeCategory }: SeriesCardProps) {
  const [hovered, setHovered] = useState(false);
  const dimmed = activeCategory !== 'ALL' && activeCategory !== series.category;

  return (
    <motion.a
      href={series.href}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      animate={{ opacity: dimmed ? 0.25 : 1 }}
      className="group block bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-8 lg:p-10 hover:border-[#2a2a2a] transition-colors duration-300"
    >
      <div className="flex items-start justify-between mb-6 md:mb-8">
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
            {series.episodes.length} {series.episodes.length > 1 ? 'posts' : 'post'}
          </span>
        </div>
      </div>

      <motion.h3
        animate={{ x: hovered ? 8 : 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.1] mb-4 md:mb-5"
        style={{ fontSize: 'clamp(1.375rem, 2.4vw, 2rem)' }}
      >
        {series.name}
      </motion.h3>

      <p
        className="text-[#9aa5af] font-light leading-relaxed mb-6 md:mb-8"
        style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.0625rem)' }}
      >
        {series.description}
      </p>

      <ul className="flex flex-col border-t border-[#1f1f1f]">
        {series.episodes.map((ep) => (
          <li
            key={ep.href}
            className="py-3 md:py-3.5 border-b border-[#1f1f1f] text-[#D7E2EA] font-light flex items-center justify-between gap-4"
            style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}
          >
            <span className="truncate">{ep.title}</span>
            <span
              aria-hidden="true"
              className="text-[#646973] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 md:mt-8 flex items-center justify-end">
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

interface SingleCardProps {
  single: SingleData;
  activeCategory: Category | 'ALL';
}

function SingleCard({ single, activeCategory }: SingleCardProps) {
  const dimmed = activeCategory !== 'ALL' && activeCategory !== single.category;

  return (
    <motion.a
      href={single.href}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      animate={{ opacity: dimmed ? 0.25 : 1 }}
      className="group flex flex-col h-full bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-7 hover:border-[#2a2a2a] transition-colors duration-300"
    >
      <div className="flex items-center justify-between mb-4 md:mb-5">
        <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs">
          {single.category}
        </span>
        <time
          dateTime={single.date}
          className="text-[#646973] tabular-nums uppercase tracking-[0.2em] text-[10px] md:text-xs"
        >
          {single.date}
        </time>
      </div>

      <h3
        className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.2] mb-3 md:mb-4 group-hover:translate-x-1 transition-transform duration-300"
        style={{ fontSize: 'clamp(1.125rem, 1.8vw, 1.5rem)' }}
      >
        {single.title}
      </h3>

      <p
        className="text-[#9aa5af] font-light leading-relaxed mb-5 md:mb-6"
        style={{ fontSize: 'clamp(0.9375rem, 1vw, 1.0625rem)' }}
      >
        {single.description}
      </p>

      <div className="mt-auto flex items-center justify-end">
        <span
          className="inline-flex items-center gap-2 text-[#D7E2EA] uppercase tracking-wider text-[11px] md:text-xs group-hover:opacity-70 transition-opacity duration-200"
        >
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

const CATEGORIES: Category[] = ['회고', 'UE5', '디지털트윈', 'AI', '도구'];

export default function AllBlogSection({ series, singles }: AllBlogSectionProps) {
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  const totalSeriesPosts = series.reduce((sum, s) => sum + s.episodes.length, 0);
  const totalPosts = totalSeriesPosts + singles.length;

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
          UE5 게임 회고, 디지털 트윈 작업 일지, AI 워크플로우 실험. 시리즈 단위로 묶어 두었고, 단편 글은 아래에 모입니다.
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

        {series.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-5 md:gap-6 lg:gap-8">
            {series.map((s) => (
              <SeriesCard
                key={s.slug}
                series={s}
                activeCategory={activeCategory}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#141414] border border-dashed border-[#1f1f1f] rounded-2xl p-8 md:p-12 text-center">
            <p
              className="text-[#9aa5af] font-light leading-relaxed"
              style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)' }}
            >
              아직 시리즈가 없습니다. 첫 글이 곧 추가됩니다.
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
              Singles
            </h2>
            <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs">
              단편 글 · {singles.length}
            </span>
          </div>

          {singles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {singles.map((s) => (
                <SingleCard
                  key={s.href}
                  single={s}
                  activeCategory={activeCategory}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#141414] border border-dashed border-[#1f1f1f] rounded-2xl p-8 md:p-12 text-center">
              <p
                className="text-[#9aa5af] font-light leading-relaxed mb-2"
                style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)' }}
              >
                아직 단편 글이 없습니다.
              </p>
              <p
                className="text-[#646973] font-light"
                style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}
              >
                Velog 글 이전과 새 단편이 곧 이곳에 쌓입니다.
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
            {series.length} series · {totalPosts} posts
          </span>
        </div>
      </div>
    </section>
  );
}
