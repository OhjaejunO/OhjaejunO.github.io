import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

interface Project {
  number: string;
  category: string;
  title: string;
  description: string;
  stack: string[];
  link: { label: string; href: string };
}

const PROJECTS: Project[] = [
  {
    number: '01',
    category: 'Game / Racing',
    title: 'Split/Second Mock',
    description:
      'UE5 기반 아케이드 레이싱 데모. Chaos Vehicles로 차량 물리·핸들링을 재구성하고, Power Play 인터랙티브 이벤트 시스템을 모킹했습니다.',
    stack: ['UE5', 'C++', 'Chaos Vehicles', 'Niagara'],
    link: { label: 'View Details', href: '/projects/split-second' },
  },
  {
    number: '02',
    category: 'Game / Multiplayer FPS',
    title: 'Apex Legends Mock (WP_4th)',
    description:
      'UE5 멀티플레이어 FPS. Listen Server·Replication 기반 네트워킹, GAS 어빌리티 시스템, UMG 인게임 UI까지 풀스택 구현.',
    stack: ['UE5', 'C++', 'GAS', 'Replication', 'UMG'],
    link: { label: 'View Details', href: '/projects/wp-4th' },
  },
  {
    number: '03',
    category: 'Digital Twin / Smart Factory',
    title: 'DigitalTwinFactory',
    description:
      '실제 공정 라인의 디지털 트윈. MQTT·WebSocket으로 IoT 센서 데이터를 실시간 스트리밍하고, 시뮬레이션·예측을 통합한 운영 환경.',
    stack: ['UE5', 'MQTT', 'WebSocket', 'Python', 'IoT'],
    link: { label: 'View Details', href: '/projects/dtf' },
  },
  {
    number: '04',
    category: 'AI Workflow / Tooling',
    title: 'AI-Native Dev Workflow',
    description:
      'Hermes Agent · Claude Code · MCP 기반의 1인 개발 워크플로우. 자동화·문서화·코드 리뷰까지 에이전트가 담당하는 도구 체계.',
    stack: ['Claude Code', 'MCP', 'Hermes Agent', 'Python', 'Obsidian'],
    link: { label: 'Live Project', href: 'https://github.com/ojaejun1995-sys' },
  },
];

interface ProjectCardProps {
  project: Project;
  index: number;
  total: number;
}

function ProjectCard({ project, index, total }: ProjectCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const isLast = index === total - 1;
  const targetScale = isLast ? 1 : 1 - (total - index - 1) * 0.04;
  const scale = useTransform(scrollYProgress, [0, 1], [1, targetScale]);

  const placeholderLabel = project.category.split('/')[0].trim();

  return (
    <div
      ref={containerRef}
      className="h-screen sticky top-0 flex items-start justify-center px-6 md:px-10 pt-8 md:pt-12"
    >
      <motion.article
        style={{ scale }}
        className="relative w-full max-w-6xl bg-[#141414] border border-[#1f1f1f] rounded-2xl p-6 md:p-8 lg:p-10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="grid md:grid-cols-[1.05fr_1fr] gap-6 md:gap-10 lg:gap-14 items-stretch">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[380px] rounded-xl overflow-hidden bg-gradient-to-br from-[#1f1f1f] via-[#161616] to-[#0c0c0c] border border-[#1f1f1f] flex items-center justify-center">
            <span
              className="text-[#2a2a2a] uppercase font-light tracking-tight text-center px-4"
              style={{ fontSize: 'clamp(1.75rem, 4.5vw, 3.75rem)' }}
            >
              {placeholderLabel}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-start justify-between mb-6 md:mb-8">
              <span
                className="text-[#646973] font-light tabular-nums"
                style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)' }}
              >
                {project.number}
              </span>
              <span className="text-[#646973] uppercase tracking-[0.3em] text-[10px] md:text-xs text-right">
                {project.category}
              </span>
            </div>

            <h3
              className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.05] mb-5 md:mb-6"
              style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2.75rem)' }}
            >
              {project.title}
            </h3>

            <p
              className="text-[#9aa5af] font-light mb-6 md:mb-8 leading-relaxed"
              style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)' }}
            >
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-8 md:mb-10">
              {project.stack.map((tech) => (
                <span
                  key={tech}
                  className="text-[11px] md:text-xs uppercase tracking-wide text-[#D7E2EA] border border-[#2a2a2a] rounded-full px-3 py-1.5"
                >
                  {tech}
                </span>
              ))}
            </div>

            <a
              href={project.link.href}
              className="group/link mt-auto inline-flex items-center gap-3 self-start text-[#D7E2EA] uppercase tracking-wider border-b border-[#D7E2EA] pb-1 hover:border-[#9aa5af] hover:text-[#9aa5af] transition-colors duration-200"
              style={{ fontSize: 'clamp(0.875rem, 1.05vw, 1rem)' }}
            >
              {project.link.label}
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover/link:translate-x-1"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

export default function ProjectsSection() {
  return (
    <section
      id="projects"
      className="relative w-full py-16 md:py-24"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="text-[#646973] uppercase tracking-[0.3em] text-xs md:text-sm mb-5 md:mb-8"
        >
          / Projects
        </motion.p>
      </div>

      <div className="relative">
        {PROJECTS.map((project, i) => (
          <ProjectCard
            key={project.number}
            project={project}
            index={i}
            total={PROJECTS.length}
          />
        ))}
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-24 mt-16 md:mt-24 flex justify-end">
        <a
          href="/projects"
          className="group/all inline-flex items-center gap-3 text-[#D7E2EA] uppercase tracking-wider hover:opacity-70 transition-opacity duration-200"
          style={{ fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
        >
          View All Projects
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover/all:translate-x-1"
          >
            →
          </span>
        </a>
      </div>
    </section>
  );
}
