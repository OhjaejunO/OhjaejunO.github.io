import { motion } from 'framer-motion';

interface ContactLink {
  label: string;
  value: string;
  href: string;
  external: boolean;
}

const LINKS: ContactLink[] = [
  {
    label: 'Email',
    value: 'ojaejun1995@gmail.com',
    href: 'mailto:ojaejun1995@gmail.com',
    external: false,
  },
  {
    label: 'GitHub',
    value: 'ojaejun1995-sys',
    href: 'https://github.com/ojaejun1995-sys',
    external: true,
  },
  {
    label: 'LinkedIn',
    value: '재준 오',
    href: 'https://www.linkedin.com/in/재준-오-1995abc',
    external: true,
  },
];

export default function ContactSection() {
  return (
    <section
      id="contact"
      className="relative w-full min-h-screen flex flex-col"
    >
      <div className="flex-1 flex items-start px-6 md:px-12 lg:px-24 py-16 md:py-24">
        <div className="w-full max-w-7xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="text-[#646973] uppercase tracking-[0.3em] text-xs md:text-sm mb-8 md:mb-12"
          >
            / Contact
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="hero-heading font-black uppercase tracking-tight leading-[0.9]"
            style={{ fontSize: 'clamp(3rem, 14vw, 15.5vw)' }}
          >
            Let&apos;s Connect.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[#9aa5af] font-light mt-8 md:mt-10 max-w-2xl leading-relaxed"
            style={{ fontSize: 'clamp(1rem, 1.4vw, 1.375rem)' }}
          >
            함께 만들 만한 게 있거나 그냥 안부 인사도 환영합니다.
          </motion.p>

          <motion.nav
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-12 md:mt-16 flex flex-wrap items-center gap-x-3 gap-y-4 md:gap-x-5"
            aria-label="Contact links"
          >
            {LINKS.map((link, i) => (
              <div key={link.label} className="flex items-center gap-x-3 md:gap-x-5">
                <a
                  href={link.href}
                  {...(link.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="group inline-flex items-baseline gap-2 md:gap-3 text-[#D7E2EA] hover:text-white transition-colors duration-200"
                >
                  <span
                    className="text-[#646973] uppercase tracking-[0.25em] group-hover:text-[#9aa5af] transition-colors duration-200"
                    style={{ fontSize: 'clamp(0.7rem, 0.9vw, 0.875rem)' }}
                  >
                    {link.label}
                  </span>
                  <span
                    className="font-light tracking-tight border-b border-transparent group-hover:border-[#D7E2EA] transition-colors duration-200"
                    style={{ fontSize: 'clamp(1rem, 1.3vw, 1.375rem)' }}
                  >
                    {link.value}
                  </span>
                </a>
                {i < LINKS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="text-[#2a2a2a]"
                    style={{ fontSize: 'clamp(1rem, 1.3vw, 1.375rem)' }}
                  >
                    ·
                  </span>
                )}
              </div>
            ))}
          </motion.nav>
        </div>
      </div>

      <footer className="border-t border-[#1a1a1a] px-6 md:px-12 lg:px-24 py-6 md:py-8">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">
          <p
            className="text-[#646973] font-light uppercase tracking-wider"
            style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.875rem)' }}
          >
            JJ.Dev © 2026
          </p>
          <p
            className="text-[#646973] font-light uppercase tracking-wider"
            style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.875rem)' }}
          >
            Built with Astro · TypeScript · Tailwind
          </p>
        </div>
      </footer>
    </section>
  );
}
