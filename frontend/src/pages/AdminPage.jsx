import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { 
  LogOut, Settings, ClipboardList, Users, ChevronLeft, Flag, UserPlus, Building2, CalendarClock, ClipboardCheck, Wallet, QrCode, Shield
} from 'lucide-react';
import RaceControlPanel from '../components/RaceControlPanel';
import SurveyResultsSection from '../components/SurveyResultsSection';
import RaceConfigPanel from '../components/RaceConfigPanel';
import PreRegistrationManagement from '../components/PreRegistrationManagement';
import SponsorsManagement from '../components/SponsorsManagement';
import VolunteerConfigManagement from '../components/VolunteerConfigManagement';
import VolunteerAssignmentsManagement from '../components/VolunteerAssignmentsManagement';
import FinancesManagement from '../components/FinancesManagement';
import QRScannerPanel from '../components/QRScannerPanel';
import UserManagement from '../components/UserManagement';

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'control');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Volver al sitio
            </Button>
            <h1 className="text-2xl font-bold">Panel de Administración</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 lg:w-auto lg:inline-flex">
            <TabsTrigger value="control" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Control</span>
              <span className="sm:hidden">Control</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Escáner QR</span>
              <span className="sm:hidden">QR</span>
            </TabsTrigger>
            <TabsTrigger value="registrations" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Atletas</span>
              <span className="sm:hidden">Atletas</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Ingresos y Gastos</span>
              <span className="sm:hidden">Finanzas</span>
            </TabsTrigger>
            <TabsTrigger value="volunteers" className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              <span className="hidden sm:inline">Turnos y Posiciones</span>
              <span className="sm:hidden">Turnos</span>
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Asignaciones</span>
              <span className="sm:hidden">Asign.</span>
            </TabsTrigger>
            <TabsTrigger value="sponsors" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Patrocinadores</span>
              <span className="sm:hidden">Sponsors</span>
            </TabsTrigger>
            <TabsTrigger value="surveys" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Encuestas</span>
              <span className="sm:hidden">Encuestas</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Flag className="w-4 h-4" />
              <span className="hidden sm:inline">Carrera</span>
              <span className="sm:hidden">Carrera</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Usuarios</span>
              <span className="sm:hidden">Usuarios</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="control">
            <RaceControlPanel embedded={true} />
          </TabsContent>

          <TabsContent value="scanner">
            <QRScannerPanel />
          </TabsContent>

          <TabsContent value="registrations">
            <PreRegistrationManagement />
          </TabsContent>

          <TabsContent value="finances">
            <FinancesManagement />
          </TabsContent>

          <TabsContent value="volunteers">
            <VolunteerConfigManagement />
          </TabsContent>

          <TabsContent value="assignments">
            <VolunteerAssignmentsManagement />
          </TabsContent>

          <TabsContent value="sponsors">
            <SponsorsManagement />
          </TabsContent>

          <TabsContent value="surveys">
            <SurveyResultsSection />
          </TabsContent>

          <TabsContent value="config">
            <RaceConfigPanel />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
