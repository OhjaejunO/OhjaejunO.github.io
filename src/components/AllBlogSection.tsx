import { motion } from 'framer-motion';
import { useState } from 'react';

type Category = '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';

interface Episode {
  title: string;
  href: string;
}

interface Series {
  number: string;
  category: Category;
  title: string;
  description: string;
  episodes: Episode[];
  href: string;
}

const SERIES: Series[] = [
  {
    number: '01',
    category: '회고',
    title: 'Apex Legends Mock — WP_4th 회고',
    description:
      'UE5 멀티플레이어 FPS를 처음부터 끝까지 만들면서 부딪힌 네트워킹·GAS·UMG 이슈와 해결 과정을 시리즈로 정리했습니다.',
    episodes: [
      { title: '01 · 프로젝트 셋업과 Listen Server 결정', href: '/blog/wp-4th/01-setup' },
      { title: '02 · Replication과 RPC 설계', href: '/blog/wp-4th/02-replication' },
      { title: '03 · GAS 어빌리티 시스템 구조', href: '/blog/wp-4th/03-gas' },
      { title: '04 · UMG 인게임 UI와 마무리', href: '/blog/wp-4th/04-umg' },
    ],
    href: '/blog/series/wp-4th',
  },
  {
    number: '02',
    category: '회고',
    title: 'Split/Second Mock 회고',
    description:
      'Chaos Vehicles로 아케이드 레이싱 차량 물리를 만든 과정. Power Play 이벤트 시스템을 모킹하면서 배운 것들.',
    episodes: [
      { title: '01 · 프로젝트 시작과 Chaos Vehicles 셋업', href: '/blog/split-second/01-setup' },
      { title: '02 · 차량 핸들링 튜닝 일지', href: '/blog/split-second/02-handling' },
      { title: '03 · Power Play 이벤트 시스템 모킹', href: '/blog/split-second/03-power-play' },
    ],
    href: '/blog/series/split-second',
  },
  {
    number: '03',
    category: '디지털트윈',
    title: 'DigitalTwinFactory 일지',
    description:
      '실제 공정 라인을 가상 환경으로 옮기는 작업 일지. MQTT·WebSocket 실시간 스트리밍과 시뮬레이션 통합 기록.',
    episodes: [
      { title: 'Day 01 · 라인 측정과 모델링 기준 잡기', href: '/blog/dtf/day-01' },
      { title: 'Day 02 · MQTT 브리지와 WebSocket 채널', href: '/blog/dtf/day-02' },
      { title: 'Day 03 · 시뮬레이션 루프 통합', href: '/blog/dtf/day-03' },
    ],
    href: '/blog/series/dtf',
  },
  {
    number: '04',
    category: 'AI',
    title: 'AI-Native Dev Workflow',
    description:
      'Hermes Agent · Claude Code · MCP로 1인 개발자가 팀처럼 일하는 워크플로우를 만들어가는 과정.',
    episodes: [
      { title: '01 · Claude Code와 MCP 시작하기', href: '/blog/ai-native/01-mcp' },
      { title: '02 · Hermes Agent로 자동화 파이프라인', href: '/blog/ai-native/02-hermes' },
    ],
    href: '/blog/series/ai-native',
  },
];

interface SeriesCardProps {
  series: Series;
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
        {series.title}
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

const CATEGORIES: Category[] = ['회고', 'UE5', '디지털트윈', 'AI', '도구'];

export default function AllBlogSection() {
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  const totalPosts = SERIES.reduce((sum, s) => sum + s.episodes.length, 0);

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
          UE5 게임 회고, 디지털 트윈 작업 일지, AI 워크플로우 실험.
          시리즈 단위로 묶어 두었고, 단편 글은 아래에 모일 예정입니다.
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

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 lg:gap-8">
          {SERIES.map((series) => (
            <SeriesCard
              key={series.number}
              series={series}
              activeCategory={activeCategory}
            />
          ))}
        </div>

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
              단편 글
            </span>
          </div>

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
            {SERIES.length} series · {totalPosts} posts
          </span>
        </div>
      </div>
    </section>
  );
}
