import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './fullpage'

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (error) {
  console.error('Failed to mount fullpage:', error);
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize extension. Please reload.</div>';
}
