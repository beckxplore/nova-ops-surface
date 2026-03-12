import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'
import { GatewayProvider } from './context/GatewayContext'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <GatewayProvider>
      <App />
    </GatewayProvider>
  </React.StrictMode>,
)
