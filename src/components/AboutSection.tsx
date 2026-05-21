import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

const PARAGRAPHS = [
  'An Unreal Engine 5 developer building games, digital twins, and AI-augmented systems.',
  'I work with Hermes Agent, Claude, and MCP-based tooling to amplify what one developer can ship.',
  'My interest lies where simulation, intelligent agents, and physical engineering converge.',
  "Let's build the next-generation tools together.",
];

interface WordProps {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}

function Word({ word, progress, range }: WordProps) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <>
      <motion.span style={{ opacity }} className="inline-block">
        {word}
      </motion.span>
      <span>{' '}</span>
    </>
  );
}

export default function AboutSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.4'],
  });

  const words = PARAGRAPHS.flatMap((p, pi) =>
    p.split(' ').map((w, wi) => ({ word: w, key: `${pi}-${wi}`, paragraphIndex: pi })),
  );
  const totalWords = words.length;

  return (
    <section
      id="about"
      ref={containerRef}
      className="relative px-6 md:px-10 lg:px-20 py-32 md:py-48 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-[#646973] uppercase tracking-[0.3em] text-xs md:text-sm mb-10 md:mb-16">
          / About
        </p>

        <div
          className="text-[#D7E2EA] font-light leading-[1.35] tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 3.6vw, 3.25rem)' }}
        >
          {PARAGRAPHS.map((paragraph, pi) => {
            const paragraphWords = paragraph.split(' ');
            return (
              <p
                key={pi}
                className={pi < PARAGRAPHS.length - 1 ? 'mb-6 md:mb-10' : ''}
              >
                {paragraphWords.map((word, wi) => {
                  const globalIndex = words.findIndex(
                    (w) => w.key === `${pi}-${wi}`,
                  );
                  const start = globalIndex / totalWords;
                  const end = (globalIndex + 1) / totalWords;
                  return (
                    <Word
                      key={`${pi}-${wi}`}
                      word={word}
                      progress={scrollYProgress}
                      range={[start, end]}
                    />
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
