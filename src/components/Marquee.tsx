import { motion } from 'framer-motion';

const ROW_1 = [
  'UE5',
  'C++',
  'Unreal Engine',
  'Multiplayer',
  'Replication',
  'Listen Server',
  'UMG',
  'Niagara',
  'GAS',
  'Chaos Vehicles',
  'Game Architecture',
  'System Design',
];

const ROW_2 = [
  'Digital Twin',
  'Smart Factory',
  'IoT',
  'MQTT',
  'WebSocket',
  'Hermes Agent',
  'Claude Code',
  'MCP',
  'Obsidian',
  'Python',
  'AI-Native Workflow',
  'Autonomous Systems',
];

interface MarqueeRowProps {
  items: string[];
  direction: 'left' | 'right';
  duration: number;
}

function MarqueeRow({ items, direction, duration }: MarqueeRowProps) {
  const content = (
    <div className="flex shrink-0 items-center gap-10 md:gap-16 pr-10 md:pr-16">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="flex items-center gap-10 md:gap-16 text-[#D7E2EA] font-light uppercase tracking-wide whitespace-nowrap"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)' }}
        >
          {item}
          <span aria-hidden="true" className="text-[#646973]">·</span>
        </span>
      ))}
    </div>
  );

  const animate =
    direction === 'left'
      ? { x: ['0%', '-50%'] }
      : { x: ['-50%', '0%'] };

  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex w-max"
        animate={animate}
        transition={{
          duration,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {content}
        {content}
      </motion.div>
    </div>
  );
}

export default function Marquee() {
  return (
    <section
      aria-label="Tech stack marquee"
      className="py-16 md:py-24 border-y border-[#1a1a1a]"
      style={{ overflowX: 'clip' }}
    >
      <div className="flex flex-col gap-6 md:gap-10">
        <MarqueeRow items={ROW_1} direction="left" duration={40} />
        <MarqueeRow items={ROW_2} direction="right" duration={45} />
      </div>
    </section>
  );
}
