import React from 'react'
import POS from './components/POS'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Por ahora cargamos directo el POS. Luego agregaremos React Router para Login y Entradas */}
      <POS />
    </div>
  )
}

export default App
