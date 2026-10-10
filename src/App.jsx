import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import POS from './components/POS'
import Home from './pages/Home'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventario" element={<div className="p-8 text-center text-gray-500">Módulo de Inventario en construcción...</div>} />
          <Route path="/reportes" element={<div className="p-8 text-center text-gray-500">Módulo de Reportes en construcción...</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
