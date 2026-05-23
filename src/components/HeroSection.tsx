import FadeIn from './FadeIn';
import Magnet from './Magnet';
import ContactButton from './ContactButton';
import Character3D from './Character3D';

export default function HeroSection() {
  return (
    <section
      className="relative h-screen"
      style={{ overflow: 'hidden' }}
    >
      <FadeIn as="nav" delay={0} y={-20} className="relative z-30">
        <nav className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-8">
          <a href="#about" className="text-xs md:text-base lg:text-[1.05rem] text-[#D7E2EA] font-medium uppercase tracking-wider hover:opacity-70 transition-opacity duration-200">
            About
          </a>
          <a href="#projects" className="text-xs md:text-base lg:text-[1.05rem] text-[#D7E2EA] font-medium uppercase tracking-wider hover:opacity-70 transition-opacity duration-200">
            Projects
          </a>
          <a href="#blog" className="text-xs md:text-base lg:text-[1.05rem] text-[#D7E2EA] font-medium uppercase tracking-wider hover:opacity-70 transition-opacity duration-200">
            Blog
          </a>
          <a href="#contact" className="text-xs md:text-base lg:text-[1.05rem] text-[#D7E2EA] font-medium uppercase tracking-wider hover:opacity-70 transition-opacity duration-200">
            Contact
          </a>
        </nav>
      </FadeIn>

      <div className="relative z-20 overflow-hidden">
        <FadeIn delay={0.15} y={40}>
          <h1
            className="hero-heading font-black uppercase tracking-tight leading-none whitespace-nowrap w-full text-center mt-10 sm:mt-8 md:mt-9"
            style={{ fontSize: 'clamp(2.25rem, 12vw, 13rem)' }}
          >
            Hi, I&apos;m JJ
          </h1>
        </FadeIn>
      </div>

      <FadeIn
        delay={0.6}
        y={30}
        className="absolute left-1/2 -translate-x-1/2 z-10 bottom-0"
      >
        <div className="w-[270px] sm:w-[345px] md:w-[420px] lg:w-[510px] aspect-[3/4]">
          <Character3D />
        </div>
      </FadeIn>

      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-between items-end px-6 md:px-10 pb-5 sm:pb-6 md:pb-8 pointer-events-none">
        <FadeIn delay={0.35} y={20} className="pointer-events-auto">
          <p
            className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug"
            style={{ fontSize: 'clamp(0.6rem, 1.05vw, 1.15rem)' }}
          >
            an unreal engine developer<br />
            working on simulations, games,<br />
            and AI-native workflows
          </p>
        </FadeIn>

        <FadeIn delay={0.5} y={20} className="pointer-events-auto">
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  );
}