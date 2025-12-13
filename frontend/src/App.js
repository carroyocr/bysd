import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import EventoPage from './pages/EventoPage';
import CorredoresPage from './pages/CorredoresPage';
import VoluntariosPage from './pages/VoluntariosPage';
import ReglasPage from './pages/ReglasPage';
import LogisticaPage from './pages/LogisticaPage';
import FAQPage from './pages/FAQPage';
import PatrocinadoresPage from './pages/PatrocinadoresPage';
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/evento" element={<EventoPage />} />
            <Route path="/corredores" element={<CorredoresPage />} />
            <Route path="/voluntarios" element={<VoluntariosPage />} />
            <Route path="/reglas" element={<ReglasPage />} />
            <Route path="/logistica" element={<LogisticaPage />} />
            <Route path="/faq" element={<FAQPage />} />
          </Routes>
        </main>
        <Footer />
        <Toaster />
      </div>
    </Router>
  );
}