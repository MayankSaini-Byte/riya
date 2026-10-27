import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRef, useState, useEffect, useCallback } from 'react'
import gsap from '../lib/gsap'
import { useGSAP } from '@gsap/react'
import LogoLoop from '../components/LogoLoop'
import { 
  SiPandas, 
  SiNumpy, 
  SiScikitlearn, 
  SiTensorflow, 
  SiKeras, 
  SiJupyter, 
  SiPytorch, 
  SiPython,
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiNodedotjs,
  SiJavascript
} from 'react-icons/si'

const techLogos = [
  // Data Science Tools
  { node: <SiPython />, title: "Python", href: "https://www.python.org/" },
  { node: <SiPandas />, title: "Pandas", href: "https://pandas.pydata.org/" },
  { node: <SiNumpy />, title: "NumPy", href: "https://numpy.org/" },
  { node: <SiScikitlearn />, title: "Scikit-Learn", href: "https://scikit-learn.org/" },
  { node: <SiTensorflow />, title: "TensorFlow", href: "https://www.tensorflow.org/" },
  { node: <SiKeras />, title: "Keras", href: "https://keras.io/" },
  { node: <SiPytorch />, title: "PyTorch", href: "https://pytorch.org/" },
  { node: <SiJupyter />, title: "Jupyter", href: "https://jupyter.org/" },
  // Web Development Tools
  { node: <SiJavascript />, title: "JavaScript", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
  { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org/" },
  { node: <SiReact />, title: "React", href: "https://react.dev/" },
  { node: <SiNextdotjs />, title: "Next.js", href: "https://nextjs.org/" },
  { node: <SiTailwindcss />, title: "Tailwind CSS", href: "https://tailwindcss.com/" },
  { node: <SiNodedotjs />, title: "Node.js", href: "https://nodejs.org/" },
];
import Antigravity from '../components/Antigravity'
import PageTransition from '../components/PageTransition'
import { InteractiveGridPattern } from '../components/InteractiveGridPattern'
import { fetchMinds, urlFor } from '../lib/sanity'

/* ─── Framer Motion variants for Hero entrance ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: 'easeOut' },
})

export default function Hero() {
  const container = useRef(null);
  const navigate = useNavigate();
  const [recentMinds, setRecentMinds] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [typingPhrase, setTypingPhrase] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const autoPlayRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchRecentMinds() {
      try {
        let minds = (await fetchMinds()).slice(0, 8);
        if (minds && minds.length === 2) {
          minds = [...minds, ...minds];
        } else if (minds && minds.length === 1) {
          minds = [...minds, ...minds, ...minds];
        }
        setRecentMinds(minds);
      } catch (err) {
        console.error("Failed to fetch recent minds:", err);
      }
    }
    fetchRecentMinds();
  }, []);

  // Typing effect
  const phrases = [
    'Where curiosity meets code.',
    'In-depth explorations of AI, ML & beyond.',
    'Crafted by the community, for the community.',
    'Ideas that push boundaries.',
    'Research, tutorials & real-world insights.',
  ];

  useEffect(() => {
    const current = phrases[typingPhrase];
    let timeout;

    if (!isDeleting && typedText.length < current.length) {
      timeout = setTimeout(() => {
        setTypedText(current.slice(0, typedText.length + 1));
      }, 50 + Math.random() * 30);
    } else if (!isDeleting && typedText.length === current.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && typedText.length > 0) {
      timeout = setTimeout(() => {
        setTypedText(current.slice(0, typedText.length - 1));
      }, 25);
    } else if (isDeleting && typedText.length === 0) {
      setIsDeleting(false);
      setTypingPhrase((prev) => (prev + 1) % phrases.length);
    }

    return () => clearTimeout(timeout);
  }, [typedText, isDeleting, typingPhrase]);

  // Auto-play carousel
  useEffect(() => {
    if (recentMinds.length <= 1) return;
    autoPlayRef.current = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % recentMinds.length);
    }, 4000);
    return () => clearInterval(autoPlayRef.current);
  }, [recentMinds.length]);

  const goTo = (dir) => {
    clearInterval(autoPlayRef.current);
    setCarouselIndex(prev => {
      const next = prev + dir;
      if (next < 0) return recentMinds.length - 1;
      if (next >= recentMinds.length) return 0;
      return next;
    });
    // Restart auto-play after manual navigation
    autoPlayRef.current = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % recentMinds.length);
    }, 4000);
  };

  // Calculate style for the sliding track
  const getTrackStyle = () => {
    return {
      transform: `translateX(calc(-${carouselIndex} * (var(--card-w) + 1.5rem)))`,
      transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      gap: '1.5rem',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'absolute',
      left: '50%',
      marginLeft: 'calc(-1 * var(--card-w) / 2)',
      width: 'max-content',
      height: '100%',
    };
  };

  // Calculate card styling (active focus effect)
  const getCardStyle = (index) => {
    const isCenter = index === carouselIndex;
    const offset = index - carouselIndex;
    const absOffset = Math.abs(offset);
    
    // Hide cards that are far away to keep the viewport clean
    const opacity = absOffset > 1 ? 0 : (isCenter ? 1 : 0.45);
    const scale = isCenter ? 1.05 : 0.92;
    const zIndex = isCenter ? 10 : 5;

    return {
      opacity,
      transform: `scale(${scale})`,
      zIndex,
      filter: isCenter ? 'none' : 'blur(2px) brightness(0.5)',
      pointerEvents: 'auto',
      transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s, filter 0.6s',
    };
  };

  useGSAP(() => {
    // Select all elements with the 'gsap-reveal' class
    const reveals = gsap.utils.toArray('.gsap-reveal');
    
    reveals.forEach((element) => {
      gsap.fromTo(element, 
        { opacity: 0, y: 60 },
        {
          opacity: 1, 
          y: 0,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 85%', // Trigger when the top of the element hits 85% of viewport
            toggleActions: 'play none none reverse'
          }
        }
      );
    });
  }, { scope: container });

  return (
    <PageTransition className="page" ref={container}>
      <section className="hero">
        {/* Antigravity Background */}
        <div className="hero-bg-antigravity">
          <Antigravity
            count={200}
            magnetRadius={6}
            ringRadius={7}
            waveSpeed={0.3}
            waveAmplitude={0.8}
            particleSize={1}
            lerpSpeed={0.03}
            color={'#888888'}
            autoAnimate={true}
            particleVariance={0.6}
          />
        </div>
        {/* Dark vignette so text stays readable */}
        <div className="hero-vignette" />

        {/* Title */}
        <motion.h1 className="hero-title" {...fadeUp(0.5)}>
          <span className="line1">Binary </span>
          <span className="line2">Minds</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p className="hero-tagline" {...fadeUp(0.7)}>
          Code. Create. Innovate.
        </motion.p>

        {/* Buttons */}
        <motion.div className="hero-buttons" {...fadeUp(0.9)}>
          <Link to="/minds" className="btn-primary interactive cursor-target" style={{ background: '#ffffff', color: '#000000', borderRadius: '4px' }}>
            Read the Minds
          </Link>
          <Link to="https://forms.gle/9o3EBp7mH5Hq6BpGA" className="btn-secondary interactive cursor-target" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
            Join the Community
          </Link>
        </motion.div>

        {/* Trusted By Section */}
        <motion.div 
          className="trusted-by"
          {...fadeUp(1.1)}
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            width: '100%',
            padding: '0.8rem 4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(5, 5, 5, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '600' }}>Trusted By</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)' }} />
              Kaziranga Community
            </span>
          </div>
          
          <div style={{ width: '1px', height: '40px', background: 'rgba(255, 255, 255, 0.1)', marginLeft: '1rem', marginRight: '1rem' }} />
          
          <div style={{ flex: 1, overflow: 'hidden', height: '40px', display: 'flex', alignItems: 'center' }}>
            <LogoLoop
              logos={techLogos}
              speed={100}
              direction="left"
              logoHeight={18}
              gap={50}
              hoverSpeed={0}
              scaleOnHover
              fadeOut
              fadeOutColor="#030008"
              ariaLabel="Data Science Tools"
            />
          </div>
        </motion.div>
      </section>

      {/* About Community Section */}
      <section className="about-section">
        <div className="about-content gsap-reveal">
          <span className="section-eyebrow">About Us</span>
          <h2 className="section-title" style={{ textAlign: 'left' }}>What is <span className="accent">Binary Minds?</span></h2>
          <div style={{ color: 'var(--muted)', fontSize: '1.2rem', lineHeight: '1.8', marginBottom: '2rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>
              Binary Minds is a passionate community of developers, innovators, and tech enthusiasts. We collaborate on cutting-edge projects, host hackathons, and share knowledge to push the boundaries of what's possible.
            </p>
            <p>
              Whether you are a beginner taking your first steps in coding or a seasoned pro looking for new challenges, you'll find a place here to learn, build, and grow together.
            </p>
          </div>
        </div>
        
        <motion.div 
          className="about-image-container gsap-reveal interactive"
          whileHover={{ y: -10, scale: 1.02 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'var(--surface)',
            borderRadius: '24px',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            margin: '0 auto'
          }}
        >
          <img src="/7587df77ef521cf98057d0028ee983f1.gif" alt="Binary Minds Community" style={{ width: '100%', borderRadius: '16px', display: 'block', filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.05))' }} />
        </motion.div>
      </section>

      {/* Minds Preview Carousel Section */}
      <section className="minds-carousel-section">
        {/* Background grid pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,0,0,0.5), transparent)',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,0,0,0.5), transparent)',
        }}>
          <InteractiveGridPattern width={40} height={40} className="grid-bg" />
        </div>

        {/* Top row: description left, title center */}
        <div className="minds-carousel-toprow gsap-reveal" style={{ position: 'relative', zIndex: 1 }}>
          <div className="minds-carousel-desc">
            <div className="typing-container">
              <span className="typing-text">{typedText}</span>
              <span className="typing-cursor">|</span>
            </div>
          </div>
          <div className="minds-carousel-title">
            <h2 className="minds-big-title">OUR MINDS</h2>
          </div>
        </div>

        {/* Full-width fanned carousel */}
        {recentMinds.length > 0 ? (
          <div className="carousel-wrapper gsap-reveal" style={{ position: 'relative', zIndex: 1 }}>
            <div className="carousel-viewport">
              <div className="carousel-track" style={getTrackStyle()}>
                {recentMinds.map((mind, index) => (
                  <motion.div 
                    key={`${mind.slug?.current || mind._id || index}-${index}`}
                    className={`carousel-card interactive${index === carouselIndex ? ' carousel-card--active' : ''}`}
                    animate={getCardStyle(index)}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                    onClick={() => {
                      if (index !== carouselIndex) {
                        clearInterval(autoPlayRef.current);
                        setCarouselIndex(index);
                        autoPlayRef.current = setInterval(() => {
                          setCarouselIndex(prev => (prev + 1) % recentMinds.length);
                        }, 4000);
                      } else if (mind.slug?.current) {
                        navigate(`/minds/${mind.slug.current}`);
                      }
                    }}
                  >
                    <div className="carousel-card-image">
                      {mind.mainImage ? (
                        <img 
                          src={urlFor(mind.mainImage).width(800).height(520).url()} 
                          alt={mind.title} 
                          loading="lazy"
                        />
                      ) : (
                        <div className="carousel-card-fallback">
                          <div className="carousel-card-fallback-line" />
                        </div>
                      )}
                      <div className="carousel-card-overlay" />
                    </div>
                    <div className="carousel-card-label">
                      <h3>{mind.title}</h3>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="carousel-nav">
              <button 
                className="carousel-arrow cursor-target interactive" 
                onClick={() => goTo(-1)}
                aria-label="Previous mind"
              >
                ←
              </button>
              <button 
                className="carousel-arrow cursor-target interactive" 
                onClick={() => goTo(1)}
                aria-label="Next mind"
              >
                →
              </button>
            </div>
          </div>
        ) : (
          <div className="gsap-reveal" style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
            <p>Fetching the latest minds from Sanity...</p>
          </div>
        )}
      </section>

    </PageTransition>
  )
}
