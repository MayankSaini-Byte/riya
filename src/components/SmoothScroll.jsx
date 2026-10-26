import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import gsap from '../lib/gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// `disabled` keeps native scrolling, e.g. in the admin portal, where Lenis
// would swallow wheel events meant for the sidebar, menus and text areas.
export default function SmoothScroll({ children, disabled = false }) {
  useEffect(() => {
    if (disabled) return undefined
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 0.9,
      smoothTouch: true,
      touchMultiplier: 1.5,
      infinite: false,
    })

    // Integrate Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)

    // Keep a reference: the ticker can only remove the exact function it was given.
    const tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)

    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [disabled])

  return <>{children}</>
}
