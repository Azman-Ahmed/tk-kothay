// import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Temporarily disabled to fix white screen */}
    {/* <Analytics /> */}
  </StrictMode>,
)
