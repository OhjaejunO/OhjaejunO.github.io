import { motion } from 'framer-motion';
import { useState } from 'react';

type Category = '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';

export interface BlogSeriesProp {
  number: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  href: string;
  episodes: Array<{ title: string; href: string }>;
}

interface BlogSectionProps {
  series: BlogSeriesProp[];
}

interface SeriesCardProps {
  series: BlogSeriesProp;
}

function SeriesCard({ series }: SeriesCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col h-full bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-8 lg:p-10 hover:border-[#2a2a2a] transition-colors duration-300"
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
          <li key={ep.href} className="border-b border-[#1f1f1f]">
            <a
              href={ep.href}
              className="group/ep flex items-center justify-between gap-4 py-3 md:py-3.5 text-[#D7E2EA] font-light hover:text-[#9aa5af] transition-colors duration-200"
              style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}
            >
              <span className="truncate transition-transform duration-200 group-hover/ep:translate-x-0.5">
                {ep.title}
              </span>
              <span
                aria-hidden="true"
                className="text-[#646973] shrink-0 transition-all duration-200 group-hover/ep:text-[#9aa5af] group-hover/ep:translate-x-0.5"
              >
                →
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-6 md:mt-8 flex items-center justify-end">
        <a
          href={series.href}
          className="group/series inline-flex items-center gap-3 text-[#D7E2EA] uppercase tracking-wider border-b border-[#D7E2EA] pb-1 hover:border-[#9aa5af] hover:text-[#9aa5af] transition-colors duration-200"
          style={{ fontSize: 'clamp(0.8125rem, 0.95vw, 0.9375rem)' }}
        >
          Read Series
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover/series:translate-x-1"
          >
            →
          </span>
        </a>
      </div>
    </motion.div>
  );
}

const CATEGORIES = ['회고', 'UE5', '디지털트윈', 'AI', '도구'] as const;

export default function BlogSection({ series }: BlogSectionProps) {
  return (
    <section
      id="blog"
      className="relative w-full px-6 md:px-12 lg:px-24 py-16 md:py-24"
    >
      <div className="w-full max-w-7xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="text-[#646973] uppercase tracking-[0.3em] text-xs md:text-sm mb-5 md:mb-8"
        >
          / Blog
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap items-center gap-2 md:gap-3 mb-10 md:mb-14"
        >
          {CATEGORIES.map((cat) => (
            <span
              key={cat}
              className="text-[11px] md:text-xs uppercase tracking-wide text-[#9aa5af] border border-[#1f1f1f] rounded-full px-3 py-1.5"
            >
              {cat}
            </span>
          ))}
        </motion.div>

        {series.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-5 md:gap-6 lg:gap-8">
            {series.map((s) => (
              <SeriesCard key={s.slug} series={s} />
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

        <div className="mt-12 md:mt-16 flex justify-end">
          <a
            href="/blog"
            className="group/all inline-flex items-center gap-3 text-[#D7E2EA] uppercase tracking-wider hover:opacity-70 transition-opacity duration-200"
            style={{ fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
          >
            View All Posts
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/all:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
