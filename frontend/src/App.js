import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { RaceConfigProvider } from './contexts/RaceConfigContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import EventoPage from './pages/EventoPage';
import CampeonatoPage from './pages/CampeonatoPage';
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
import CancelRegistrationPage from './pages/CancelRegistrationPage';
import QRScannerPage from './pages/QRScannerPage';
import ScanConfirmPage from './pages/ScanConfirmPage';
import MyProfilePage from './pages/MyProfilePage';
import TshirtVotePage from './pages/TshirtVotePage';
import AlbumPage from './pages/AlbumPage';
import LiveApp from './live/LiveApp';
import { isNative } from './lib/platform';
import useAndroidBack from './lib/androidBack';
import './App.css';

export default function App() {
  return (
    <RaceConfigProvider>
    <Router>
      <ScrollToTop />
      <BotonAtrasAndroid />
      <div className="min-h-screen flex flex-col">
        <Routes>
          {/* App nativa: entra directo a BYSD Live; el perfil del atleta y el
              acceso de staff son opciones dentro de su menú lateral */}
          {isNative() && <Route path="/" element={<Navigate to="/live" replace />} />}

          {/* Admin routes without Navigation/Footer */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/race-control" element={<RaceControlPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/mensajes/presentacion" element={<MensajesPresentacionPage />} />
          
          {/* QR Scanner routes without Navigation/Footer - optimized for mobile */}
          <Route path="/scan" element={<QRScannerPage />} />
          <Route path="/scan/confirmar" element={<ScanConfirmPage />} />

          {/* BYSD Live: app movil de seguimiento para espectadores, sin Navigation/Footer */}
          <Route path="/live/*" element={<LiveApp />} />
          
          {/* Public routes with Navigation/Footer */}
          <Route
            path="/*"
            element={
              <>
                <Navigation />
                {/* Compensa la altura extra que el safe-area agrega al nav fijo */}
                <main className="flex-1 pt-[env(safe-area-inset-top)]">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/evento" element={<EventoPage />} />
                    <Route path="/campeonato" element={<CampeonatoPage />} />
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
                    {/* T-shirt design voting */}
                    <Route path="/vota-camiseta" element={<TshirtVotePage />} />
                    {/* Event photo album 2026 */}
                    <Route path="/album" element={<AlbumPage />} />
                    {/* Payment Receipt Upload */}
                    <Route path="/subir-comprobante" element={<PaymentReceiptPage />} />
                    {/* Cancel Registration */}
                    <Route path="/cancelar-registro" element={<CancelRegistrationPage />} />
                    {/* Volunteer Registration routes */}
                    <Route path="/voluntarios/registro" element={<VoluntarioRegistroPage />} />
                    {/* Athlete Profile + Legacy routes */}
                    <Route path="/mi-perfil" element={<MyProfilePage />} />
                    <Route path="/pre-registro" element={<MyProfilePage />} />
                    <Route path="/pre-registro/editar" element={<MyProfilePage />} />
                    <Route path="/inscripcion" element={<MyProfilePage />} />
                    <Route path="/inscripcion/editar" element={<MyProfilePage />} />
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

/** Atiende el botón/gesto de atrás de Android. Vive dentro del Router. */
function BotonAtrasAndroid() {
  useAndroidBack();
  return null;
}
