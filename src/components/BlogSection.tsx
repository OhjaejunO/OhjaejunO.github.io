import { motion } from 'framer-motion';
import { useState } from 'react';

interface Episode {
  title: string;
  href: string;
}

interface Series {
  number: string;
  category: '회고' | 'UE5' | '디지털트윈' | 'AI' | '도구';
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
      { title: '단편 · 차량 핸들링과 Power Play 모킹', href: '/blog/split-second/recap' },
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

const CATEGORIES = ['회고', 'UE5', '디지털트윈', 'AI', '도구'] as const;

export default function BlogSection() {
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

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 lg:gap-8">
          {SERIES.map((series) => (
            <SeriesCard key={series.number} series={series} />
          ))}
        </div>

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
