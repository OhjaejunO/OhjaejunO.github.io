import type { CSSProperties } from 'react';

interface ContactButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

const buttonStyle: CSSProperties = {
  background: 'linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)',
  boxShadow: '0px 4px 4px rgba(181, 1, 167, 0.25), 4px 4px 12px #7721B1 inset',
  outline: '2px solid white',
  outlineOffset: '-3px',
};

export default function ContactButton(props: ContactButtonProps) {
  const href = props.href ?? 'mailto:ojaejun1995@gmail.com';
  const label = props.label ?? 'Contact Me';
  const className = props.className ?? '';

  const baseClass = 'inline-block rounded-full px-10 py-4 sm:px-12 sm:py-5 md:px-16 md:py-6 lg:px-20 lg:py-7 text-sm sm:text-base md:text-xl lg:text-2xl text-white font-medium uppercase tracking-widest transition-transform duration-300 hover:scale-105';

  return (
    <a
      href={href}
      className={baseClass + ' ' + className}
      style={buttonStyle}
    >
      {label}
    </a>
  );
}