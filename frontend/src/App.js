import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { RaceConfigProvider } from './contexts/RaceConfigContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import EventoPage from './pages/EventoPage';
import CorredoresPage from './pages/CorredoresPage';
import VoluntariosPage from './pages/VoluntariosPage';
import ReglasPage from './pages/ReglasPage';
import LogisticaPage from './pages/LogisticaPage';
import FAQPage from './pages/FAQPage';
import PatrocinadoresPage from './pages/PatrocinadoresPage';
import LiveDashboardPage from './pages/LiveDashboardPage';
import ComunidadPage from './pages/ComunidadPage';
import EnviarAnimoPage from './pages/EnviarAnimoPage';
import MensajesPresentacionPage from './pages/MensajesPresentacionPage';
import AdminLoginPage from './pages/AdminLoginPage';
import RaceControlPage from './pages/RaceControlPage';
import AdminPage from './pages/AdminPage';
import SurveyPage from './pages/SurveyPage';
import InscripcionPage from './pages/InscripcionPage';
import VoluntarioRegistroPage from './pages/VoluntarioRegistroPage';
import PaymentReceiptPage from './pages/PaymentReceiptPage';
import './App.css';

export default function App() {
  return (
    <RaceConfigProvider>
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col">
        <Routes>
          {/* Admin routes without Navigation/Footer */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/race-control" element={<RaceControlPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/mensajes/presentacion" element={<MensajesPresentacionPage />} />
          
          {/* Public routes with Navigation/Footer */}
          <Route
            path="/*"
            element={
              <>
                <Navigation />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/evento" element={<EventoPage />} />
                    <Route path="/corredores" element={<CorredoresPage />} />
                    <Route path="/voluntarios" element={<VoluntariosPage />} />
                    <Route path="/reglas" element={<ReglasPage />} />
                    <Route path="/logistica" element={<LogisticaPage />} />
                    {/* Patrocinadores routes - with and without race code */}
                    <Route path="/patrocinadores" element={<PatrocinadoresPage />} />
                    <Route path="/patrocinadores/:raceCode" element={<PatrocinadoresPage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    {/* Resultados routes - with and without race code */}
                    <Route path="/en-vivo" element={<LiveDashboardPage />} />
                    <Route path="/resultados/:raceCode" element={<LiveDashboardPage />} />
                    {/* Comunidad routes - with and without race code */}
                    <Route path="/comunidad" element={<ComunidadPage />} />
                    <Route path="/comunidad/:raceCode" element={<ComunidadPage />} />
                    <Route path="/enviar-animo/:bib" element={<EnviarAnimoPage />} />
                    <Route path="/encuesta" element={<SurveyPage />} />
                    {/* Pre Registro routes */}
                    <Route path="/pre-registro" element={<InscripcionPage />} />
                    <Route path="/pre-registro/editar" element={<InscripcionPage />} />
                    {/* Volunteer Registration routes */}
                    <Route path="/voluntarios/registro" element={<VoluntarioRegistroPage />} />
                    {/* Legacy routes - redirect */}
                    <Route path="/inscripcion" element={<InscripcionPage />} />
                    <Route path="/inscripcion/editar" element={<InscripcionPage />} />
                  </Routes>
                </main>
                <Footer />
              </>
            }
          />
        </Routes>
        <Toaster />
      </div>
    </Router>
    </RaceConfigProvider>
  );
}