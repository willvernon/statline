import './styles.css'

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { DataProvider } from './data/DataContext.tsx'
import { Compare } from './screens/Compare.tsx'
import { Explorer } from './screens/Explorer.tsx'
import { NotFound } from './screens/NotFound.tsx'
import { PlayerPage } from './screens/PlayerPage.tsx'
import { ShareCard } from './screens/ShareCard.tsx'
import { TeamsPage } from './screens/TeamsPage.tsx'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollTop />
      <DataProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/wr" replace />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/player/:id/:slug?" element={<PlayerPage />} />
          <Route path="/player/:id/:slug/card" element={<ShareCard />} />
          <Route path="/compare/:a/:b?" element={<Compare />} />
          <Route path="/:pos" element={<Explorer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DataProvider>
    </BrowserRouter>
  </StrictMode>,
)
