import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'nav';
}

export default function FadeIn(props: FadeInProps) {
  const delay = props.delay ?? 0;
  const duration = props.duration ?? 0.7;
  const x = props.x ?? 0;
  const y = props.y ?? 30;
  const className = props.className ?? '';
  const as = props.as ?? 'div';

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      initial={{ opacity: 0, x: x, y: y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{
        duration: duration,
        delay: delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {props.children}
    </MotionTag>
  );
}