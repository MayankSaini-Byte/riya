import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import ParticleCanvas from './components/ParticleCanvas'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import SmoothScroll from './components/SmoothScroll'
import TargetCursor from './components/TargetCursor'
import PublicAnnouncements from './components/PublicAnnouncements'

import Hero from './pages/Hero'
import Minds from './pages/Minds'
import MindDetail from './pages/MindDetail'
import Events from './pages/Events'
import BuildInPublic from './pages/BuildInPublic'
import BuildInPublicProject from './pages/BuildInPublicProject'
import NotFound from './pages/NotFound'
import AdminPortal from './pages/AdminPortal'

function App() {
  const location = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const isAdmin = location.pathname.startsWith('/kazi_binary_admins')
  const hideNavAndFooter = location.pathname.startsWith('/minds/') || isAdmin
  
  return (
    <SmoothScroll disabled={isAdmin}>
      {!isAdmin && <TargetCursor />}
      {!hideNavAndFooter && <Navbar />}
      {!isAdmin && <PublicAnnouncements />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Hero />} />
          <Route path="/minds" element={<Minds />} />
          <Route path="/minds/:slug" element={<MindDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/build-in-public" element={<BuildInPublic />} />
          <Route path="/build-in-public/:projectId" element={<BuildInPublicProject />} />
          <Route path="/blitz" element={<Navigate to="/build-in-public" replace />} />
          <Route path="/blitz/:slug" element={<Navigate to="/build-in-public" replace />} />
          <Route path="/kazi_binary_admins/*" element={<AdminPortal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      {!hideNavAndFooter && <Footer />}
    </SmoothScroll>
  )
}

export default App
