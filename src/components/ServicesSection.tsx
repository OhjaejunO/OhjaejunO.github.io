import { motion } from 'framer-motion';
import { useState } from 'react';

interface Service {
  number: string;
  title: string;
  description: string;
}

const SERVICES: Service[] = [
  {
    number: '01',
    title: 'Unreal Engine Development',
    description:
      '게임플레이, 멀티플레이어, 시네마틱까지 — UE5 기반의 인터랙티브 경험을 설계하고 구현합니다.',
  },
  {
    number: '02',
    title: 'Digital Twin Engineering',
    description:
      '실제 공정·장비를 시뮬레이션 가능한 가상 환경으로 옮겨, 운영·검증·예측이 가능한 디지털 트윈을 만듭니다.',
  },
  {
    number: '03',
    title: 'AI Agent Integration',
    description:
      'Hermes Agent와 Claude·MCP 기반 도구를 워크플로우에 결합해, 한 사람의 개발자가 팀처럼 일하도록 만듭니다.',
  },
  {
    number: '04',
    title: 'Simulation & Automation',
    description:
      '차량·물리·로직 시뮬레이션과 자동화 파이프라인으로, 반복 작업을 시스템으로 대체합니다.',
  },
  {
    number: '05',
    title: 'System Architecture & Networking',
    description:
      'Listen Server, Replication, 메시지 큐까지 — 견고한 멀티플레이어·분산 시스템을 설계합니다.',
  },
];

interface RowProps {
  service: Service;
  isLast: boolean;
}

function ServiceRow({ service, isLast }: RowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className={`group relative grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-x-6 md:gap-x-10 lg:gap-x-16 items-baseline py-8 md:py-12 border-t border-[#1a1a1a] ${
        isLast ? 'border-b' : ''
      }`}
    >
      <span
        className="text-[#646973] font-light tabular-nums"
        style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)' }}
      >
        {service.number}
      </span>

      <div className="col-span-1 md:col-auto">
        <motion.h3
          animate={{ x: hovered ? 16 : 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-light uppercase tracking-tight text-[#D7E2EA] leading-[1.05]"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3.25rem)' }}
        >
          {service.title}
        </motion.h3>

        <p
          className="text-[#646973] font-light mt-4 md:mt-6 max-w-2xl leading-relaxed"
          style={{ fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
        >
          {service.description}
        </p>
      </div>

      <motion.span
        aria-hidden="true"
        animate={{
          opacity: hovered ? 1 : 0,
          x: hovered ? 0 : -10,
        }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="hidden md:block text-[#D7E2EA] self-center"
        style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)' }}
      >
        →
      </motion.span>
    </motion.div>
  );
}

export default function ServicesSection() {
  return (
    <section
      id="services"
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
          / Services
        </motion.p>

        <div className="flex flex-col">
          {SERVICES.map((service, i) => (
            <ServiceRow
              key={service.number}
              service={service}
              isLast={i === SERVICES.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
