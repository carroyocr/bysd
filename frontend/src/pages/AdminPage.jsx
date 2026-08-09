import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { 
  LogOut, Settings, ClipboardList, Users, ChevronLeft, Flag, UserPlus, Building2, CalendarClock, ClipboardCheck, Wallet, QrCode, Shield, Mail, Clock, Trophy, Send, Shirt, GraduationCap, MessageCircle, Medal, Newspaper, Megaphone, Bell
} from 'lucide-react';
import RaceControlPanel from '../components/RaceControlPanel';
import LapRegistrationsPanel from '../components/LapRegistrationsPanel';
import SurveyResultsSection from '../components/SurveyResultsSection';
import RaceConfigPanel from '../components/RaceConfigPanel';
import PreRegistrationManagement from '../components/PreRegistrationManagement';
import SponsorsManagement from '../components/SponsorsManagement';
import AdsManagement from '../components/AdsManagement';
import VolunteerConfigManagement from '../components/VolunteerConfigManagement';
import VolunteerAssignmentsManagement from '../components/VolunteerAssignmentsManagement';
import FinancesManagement from '../components/FinancesManagement';
import UserManagement from '../components/UserManagement';
import EmailTemplatesManagement from '../components/EmailTemplatesManagement';
import ClaimedResultsManagement from '../components/ClaimedResultsManagement';
import AthleteProfilesManagement from '../components/AthleteProfilesManagement';
import EmailComposer from '../components/EmailComposer';
import WhatsAppComposer from '../components/WhatsAppComposer';
import TshirtManagement from '../components/TshirtManagement';
import CapacitacionesManagement from '../components/CapacitacionesManagement';
import SeleccionadosManagement from '../components/SeleccionadosManagement';
import PrensaManagement from '../components/PrensaManagement';
import PushComposer from '../components/PushComposer';
import ChangePasswordDialog from '../components/ChangePasswordDialog';

// Permisos que abren cada tab: el primero es el permiso propio del tab y el
// segundo el permiso "sombrilla" histórico de su grupo (sigue valiendo).
const TAB_PERMISSIONS = {
  'control': ['race-control', 'control'],
  'lap-registry': ['laps', 'control'],
  // Tambien lo abre quien lleva las comunicaciones: es el mismo trabajo
  // que el envio de correos, con otro canal.
  'app-avisos': ['app-avisos', 'control', 'emails'],
  'registrations': ['registrations', 'athletes'],
  'finances': ['finances'],
  'volunteers': ['shifts', 'volunteers'],
  'assignments': ['assignments', 'volunteers'],
  'sponsors': ['sponsors'],
  'ads': ['ads', 'sponsors'],
  'surveys': ['surveys'],
  'config': ['race-config', 'config'],
  'users': ['users'],
  'emails': ['email-templates', 'emails'],
  'results-2026': ['results-2026', 'athletes'],
  'athlete-profiles': ['athlete-profiles', 'athletes'],
  'email-composer': ['email-composer', 'emails'],
  'whatsapp': ['whatsapp', 'emails'],
  'tshirt': ['tshirt', 'config'],
  'capacitaciones': ['capacitaciones', 'config'],
  'seleccionados': ['seleccionados', 'athletes'],
  'prensa': ['prensa', 'emails'],
};

const canOpenTab = (permissions, tabId) =>
  (TAB_PERMISSIONS[tabId] || []).some((p) => permissions.includes(p));

// Special permissions that are not tabs (used for menu buttons like scanner)
const SPECIAL_PERMISSIONS = ['scanner'];

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
    } else {
      setIsAuthenticated(true);
      
      // Load permissions from localStorage
      const isAdminUser = localStorage.getItem('admin_is_admin') === 'true';
      setIsAdmin(isAdminUser);
      
      try {
        const permissions = JSON.parse(localStorage.getItem('admin_permissions') || '[]');
        setUserPermissions(permissions);
        
        // Check if user ONLY has scanner permission - redirect directly to /scan
        const hasOnlyScanner = permissions.length === 1 && permissions[0] === 'scanner';
        if (hasOnlyScanner && !isAdminUser) {
          navigate('/scan');
          return;
        }
        
        // Set initial tab based on permissions
        const requestedTab = searchParams.get('tab') || 'control';
        if (isAdminUser || permissions.includes('all') || canOpenTab(permissions, requestedTab)) {
          setActiveTab(requestedTab);
        } else {
          // Find first allowed tab
          const firstAllowedTab = Object.keys(TAB_PERMISSIONS).find(tab =>
            canOpenTab(permissions, tab)
          );
          if (firstAllowedTab) {
            setActiveTab(firstAllowedTab);
          } else if (permissions.includes('scanner')) {
            // User only has scanner permission, redirect to scanner
            navigate('/scan');
            return;
          } else {
            setActiveTab('control');
          }
        }
      } catch (e) {
        setUserPermissions([]);
        setActiveTab('control');
      }
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (activeTab) {
      setSearchParams({ tab: activeTab });
    }
  }, [activeTab, setSearchParams]);

  // Check if user has access to a specific tab or special permission
  const hasAccess = (tabId) => {
    if (isAdmin) return true;
    if (userPermissions.includes('all')) return true;

    // Check for special permissions (like 'scanner')
    if (SPECIAL_PERMISSIONS.includes(tabId)) {
      return userPermissions.includes(tabId);
    }

    return canOpenTab(userPermissions, tabId);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_is_admin');
    localStorage.removeItem('admin_permissions');
    navigate('/admin/login');
  };

  if (!isAuthenticated || !activeTab) {
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
          <div className="flex items-center gap-2">
            <ChangePasswordDialog />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Tabs Navigation - Sidebar layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-col lg:flex-row gap-6 items-start">
          <TabsList className="flex flex-col w-full lg:w-60 shrink-0 h-auto gap-1 bg-muted/40 p-2 rounded-xl [&>*]:w-full [&>*]:justify-start">
            {/* 1. Control */}
            {hasAccess('control') && (
              <TabsTrigger value="control" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Control</span>
                <span className="sm:hidden">Control</span>
              </TabsTrigger>
            )}
            {/* 2. Vueltas */}
            {hasAccess('lap-registry') && (
              <TabsTrigger value="lap-registry" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Vueltas</span>
                <span className="sm:hidden">Vueltas</span>
              </TabsTrigger>
            )}
            {/* 2b. Avisos a la app móvil */}
            {hasAccess('app-avisos') && (
              <TabsTrigger value="app-avisos" className="flex items-center gap-2" data-testid="tab-app-avisos">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Mensajes App</span>
                <span className="sm:hidden">Mensajes</span>
              </TabsTrigger>
            )}
            {/* 3. Escáner QR */}
            {hasAccess('scanner') && (
              <Button
                variant="ghost"
                onClick={() => navigate('/scan')}
                className="flex items-center gap-2 px-3 py-1.5 h-auto text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Escáner QR</span>
                <span className="sm:hidden">QR</span>
              </Button>
            )}
            {/* 4. Atletas */}
            {hasAccess('registrations') && (
              <TabsTrigger value="registrations" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Atletas</span>
                <span className="sm:hidden">Atletas</span>
              </TabsTrigger>
            )}
            {/* 4b. Finanzas */}
            {hasAccess('finances') && (
              <TabsTrigger value="finances" className="flex items-center gap-2" data-testid="tab-finances">
                <Wallet className="w-4 h-4" />
                <span>Finanzas</span>
              </TabsTrigger>
            )}
            {/* 5. Voluntarios (antes Asignaciones) */}
            {hasAccess('assignments') && (
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Voluntarios</span>
                <span className="sm:hidden">Volunt.</span>
              </TabsTrigger>
            )}
            {/* 6. Turnos */}
            {hasAccess('volunteers') && (
              <TabsTrigger value="volunteers" className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                <span className="hidden sm:inline">Turnos</span>
                <span className="sm:hidden">Turnos</span>
              </TabsTrigger>
            )}
            {/* 7. Patrocinadores */}
            {hasAccess('sponsors') && (
              <TabsTrigger value="sponsors" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Patrocinadores</span>
                <span className="sm:hidden">Sponsors</span>
              </TabsTrigger>
            )}
            {/* 7b. Publicidad (banners de BYSD Live) */}
            {hasAccess('ads') && (
              <TabsTrigger value="ads" className="flex items-center gap-2">
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">Publicidad</span>
                <span className="sm:hidden">Ads</span>
              </TabsTrigger>
            )}
            {/* 8. Encuesta */}
            {hasAccess('surveys') && (
              <TabsTrigger value="surveys" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Encuesta</span>
                <span className="sm:hidden">Encuesta</span>
              </TabsTrigger>
            )}
            {/* 9. Correos */}
            {hasAccess('emails') && (
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Correos</span>
                <span className="sm:hidden">Correos</span>
              </TabsTrigger>
            )}
            {/* 10. Resultados 2026 */}
            {hasAccess('results-2026') && (
              <TabsTrigger value="results-2026" className="flex items-center gap-2" data-testid="tab-results-2026">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Resultados 2026</span>
                <span className="sm:hidden">2026</span>
              </TabsTrigger>
            )}
            {/* 10b. Seleccionados (Campeonato Mundial) */}
            {hasAccess('seleccionados') && (
              <TabsTrigger value="seleccionados" className="flex items-center gap-2" data-testid="tab-seleccionados">
                <Medal className="w-4 h-4" />
                <span className="hidden sm:inline">Seleccionados</span>
                <span className="sm:hidden">Selecc.</span>
              </TabsTrigger>
            )}
            {/* 11. Perfiles de Atletas */}
            {hasAccess('athlete-profiles') && (
              <TabsTrigger value="athlete-profiles" className="flex items-center gap-2" data-testid="tab-athlete-profiles">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Perfiles</span>
                <span className="sm:hidden">Perfiles</span>
              </TabsTrigger>
            )}
            {/* 12. Enviar Correos */}
            {hasAccess('email-composer') && (
              <TabsTrigger value="email-composer" className="flex items-center gap-2" data-testid="tab-email-composer">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar Correos</span>
                <span className="sm:hidden">Enviar</span>
              </TabsTrigger>
            )}
            {/* 12b. WhatsApp */}
            {hasAccess('whatsapp') && (
              <TabsTrigger value="whatsapp" className="flex items-center gap-2" data-testid="tab-whatsapp">
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </TabsTrigger>
            )}
            {/* 13. Camisetas */}
            {hasAccess('tshirt') && (
              <TabsTrigger value="tshirt" className="flex items-center gap-2" data-testid="tab-tshirt">
                <Shirt className="w-4 h-4" />
                <span className="hidden sm:inline">Camisetas</span>
                <span className="sm:hidden">Camisetas</span>
              </TabsTrigger>
            )}
            {/* 13b. Prensa */}
            {hasAccess('prensa') && (
              <TabsTrigger value="prensa" className="flex items-center gap-2" data-testid="tab-prensa">
                <Newspaper className="w-4 h-4" />
                <span>Prensa</span>
              </TabsTrigger>
            )}
            {/* 14. Capacitaciones */}
            {hasAccess('capacitaciones') && (
              <TabsTrigger value="capacitaciones" className="flex items-center gap-2" data-testid="tab-capacitaciones">
                <GraduationCap className="w-4 h-4" />
                <span>Capacitaciones</span>
              </TabsTrigger>
            )}
            {/* 10. Usuarios */}
            {hasAccess('users') && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Usuarios</span>
                <span className="sm:hidden">Usuarios</span>
              </TabsTrigger>
            )}
            {/* 11. Carrera */}
            {hasAccess('config') && (
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                <span className="hidden sm:inline">Carrera</span>
                <span className="sm:hidden">Carrera</span>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 min-w-0 w-full">
          {hasAccess('control') && (
            <TabsContent value="control">
              <RaceControlPanel embedded={true} />
            </TabsContent>
          )}

          {hasAccess('lap-registry') && (
            <TabsContent value="lap-registry">
              <LapRegistrationsPanel />
            </TabsContent>
          )}

          {hasAccess('app-avisos') && (
            <TabsContent value="app-avisos">
              <PushComposer />
            </TabsContent>
          )}

          {hasAccess('registrations') && (
            <TabsContent value="registrations">
              <PreRegistrationManagement />
            </TabsContent>
          )}

          {hasAccess('finances') && (
            <TabsContent value="finances">
              <FinancesManagement />
            </TabsContent>
          )}

          {hasAccess('volunteers') && (
            <TabsContent value="volunteers">
              <VolunteerConfigManagement />
            </TabsContent>
          )}

          {hasAccess('assignments') && (
            <TabsContent value="assignments">
              <VolunteerAssignmentsManagement />
            </TabsContent>
          )}

          {hasAccess('sponsors') && (
            <TabsContent value="sponsors">
              <SponsorsManagement />
            </TabsContent>
          )}

          {hasAccess('ads') && (
            <TabsContent value="ads">
              <AdsManagement />
            </TabsContent>
          )}

          {hasAccess('surveys') && (
            <TabsContent value="surveys">
              <SurveyResultsSection />
            </TabsContent>
          )}

          {hasAccess('config') && (
            <TabsContent value="config">
              <RaceConfigPanel />
            </TabsContent>
          )}

          {hasAccess('users') && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}

          {hasAccess('emails') && (
            <TabsContent value="emails">
              <EmailTemplatesManagement />
            </TabsContent>
          )}

          {hasAccess('results-2026') && (
            <TabsContent value="results-2026">
              <ClaimedResultsManagement />
            </TabsContent>
          )}

          {hasAccess('athlete-profiles') && (
            <TabsContent value="athlete-profiles">
              <AthleteProfilesManagement />
            </TabsContent>
          )}

          {hasAccess('email-composer') && (
            <TabsContent value="email-composer">
              <EmailComposer />
            </TabsContent>
          )}

          {hasAccess('whatsapp') && (
            <TabsContent value="whatsapp">
              <WhatsAppComposer />
            </TabsContent>
          )}

          {hasAccess('tshirt') && (
            <TabsContent value="tshirt">
              <TshirtManagement />
            </TabsContent>
          )}

          {hasAccess('capacitaciones') && (
            <TabsContent value="capacitaciones">
              <CapacitacionesManagement />
            </TabsContent>
          )}

          {hasAccess('seleccionados') && (
            <TabsContent value="seleccionados">
              <SeleccionadosManagement />
            </TabsContent>
          )}

          {hasAccess('prensa') && (
            <TabsContent value="prensa">
              <PrensaManagement />
            </TabsContent>
          )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
