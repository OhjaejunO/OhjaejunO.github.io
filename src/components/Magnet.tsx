import { useRef, useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';

interface MagnetProps {
  children: ReactNode;
  padding?: number;
  strength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  className?: string;
}

export default function Magnet(props: MagnetProps) {
  const padding = props.padding ?? 150;
  const strength = props.strength ?? 3;
  const activeTransition = props.activeTransition ?? 'transform 0.3s ease-out';
  const inactiveTransition = props.inactiveTransition ?? 'transform 0.6s ease-in-out';
  const className = props.className ?? '';

  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('translate3d(0, 0, 0)');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;

      const isInside =
        Math.abs(distX) < rect.width / 2 + padding &&
        Math.abs(distY) < rect.height / 2 + padding;

      if (isInside) {
        setIsActive(true);
        setTransform('translate3d(' + (distX / strength) + 'px, ' + (distY / strength) + 'px, 0)');
      } else if (isActive) {
        setIsActive(false);
        setTransform('translate3d(0, 0, 0)');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [padding, strength, isActive]);

  const style: CSSProperties = {
    transform: transform,
    transition: isActive ? activeTransition : inactiveTransition,
    willChange: 'transform',
  };

  return (
    <div ref={ref} style={style} className={className}>
      {props.children}
    </div>
  );
}