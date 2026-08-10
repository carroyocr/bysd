import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  LogOut, Settings, ClipboardList, Users, ChevronLeft, ChevronDown, Flag, UserPlus,
  Building2, CalendarClock, ClipboardCheck, Wallet, QrCode, Shield, Mail, Clock,
  Trophy, Send, Shirt, GraduationCap, MessageCircle, Medal, Newspaper, Megaphone,
  Bell, Radio
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

// Categorías de la barra superior. Cada una agrupa los accesos de un área de
// trabajo; el orden aquí es el que se ve y también el que decide a qué sección
// cae un usuario que no tiene permiso para la que pidió.
// `to` marca los accesos que salen del panel (el escáner es su propia página).
const ADMIN_SECTIONS = [
  {
    id: 'en-vivo',
    label: 'En Vivo',
    icon: Radio,
    items: [
      { id: 'control', label: 'Control', icon: Users },
      { id: 'lap-registry', label: 'Vueltas', icon: Clock },
      { id: 'scanner', label: 'Escáner QR', icon: QrCode, to: '/scan' },
      { id: 'app-avisos', label: 'Mensajes App', icon: Bell },
    ],
  },
  {
    id: 'atletas',
    label: 'Atletas',
    icon: UserPlus,
    items: [
      { id: 'registrations', label: 'Inscripciones', icon: UserPlus },
      { id: 'athlete-profiles', label: 'Perfiles', icon: Users },
      { id: 'results-2026', label: 'Resultados 2026', icon: Trophy },
      { id: 'seleccionados', label: 'Seleccionados', icon: Medal },
      { id: 'tshirt', label: 'Camisetas', icon: Shirt },
    ],
  },
  {
    id: 'voluntarios',
    label: 'Voluntarios',
    icon: ClipboardCheck,
    items: [
      { id: 'assignments', label: 'Voluntarios', icon: ClipboardCheck },
      { id: 'volunteers', label: 'Turnos', icon: CalendarClock },
      { id: 'capacitaciones', label: 'Capacitaciones', icon: GraduationCap },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: Building2,
    items: [
      { id: 'sponsors', label: 'Patrocinadores', icon: Building2 },
      { id: 'ads', label: 'Publicidad', icon: Megaphone },
      { id: 'finances', label: 'Finanzas', icon: Wallet },
    ],
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: Send,
    items: [
      { id: 'email-composer', label: 'Enviar Correos', icon: Send },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
      { id: 'emails', label: 'Plantillas de Correo', icon: Mail },
      { id: 'prensa', label: 'Prensa', icon: Newspaper },
    ],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { id: 'config', label: 'Carrera', icon: Flag },
      { id: 'users', label: 'Usuarios', icon: Shield },
      { id: 'surveys', label: 'Encuesta', icon: ClipboardList },
    ],
  },
];

// Accesos que abren contenido dentro del panel, en el orden de la barra.
const TAB_ORDER = ADMIN_SECTIONS.flatMap((s) => s.items.filter((i) => !i.to).map((i) => i.id));

const findItem = (tabId) => {
  for (const section of ADMIN_SECTIONS) {
    const item = section.items.find((i) => i.id === tabId);
    if (item) return { section, item };
  }
  return null;
};

// Vista de cada acceso. Son funciones a nivel de módulo (no componentes
// definidos dentro del render) para que el contenido no se remonte solo.
const TAB_VIEWS = {
  'control': () => <RaceControlPanel embedded={true} />,
  'lap-registry': () => <LapRegistrationsPanel />,
  'app-avisos': () => <PushComposer />,
  'registrations': () => <PreRegistrationManagement />,
  'athlete-profiles': () => <AthleteProfilesManagement />,
  'results-2026': () => <ClaimedResultsManagement />,
  'seleccionados': () => <SeleccionadosManagement />,
  'tshirt': () => <TshirtManagement />,
  'assignments': () => <VolunteerAssignmentsManagement />,
  'volunteers': () => <VolunteerConfigManagement />,
  'capacitaciones': () => <CapacitacionesManagement />,
  'sponsors': () => <SponsorsManagement />,
  'ads': () => <AdsManagement />,
  'finances': () => <FinancesManagement />,
  'email-composer': () => <EmailComposer />,
  'whatsapp': () => <WhatsAppComposer />,
  'emails': () => <EmailTemplatesManagement />,
  'prensa': () => <PrensaManagement />,
  'config': () => <RaceConfigPanel />,
  'users': () => <UserManagement />,
  'surveys': () => <SurveyResultsSection />,
};

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
          // Primer acceso permitido, siguiendo el orden de la barra
          const firstAllowedTab = TAB_ORDER.find((tab) => canOpenTab(permissions, tab));
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

  // Una categoría solo se muestra si el usuario puede entrar a algo dentro
  const visibleSections = ADMIN_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => hasAccess(i.id)) }))
    .filter((section) => section.items.length > 0);

  const actual = findItem(activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
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

        {/* Barra de categorías */}
        <div className="flex flex-wrap items-center gap-1 bg-muted/40 p-1.5 rounded-xl mb-4">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            const isCurrent = section.items.some((i) => i.id === activeTab);
            return (
              <DropdownMenu key={section.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isCurrent ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                    data-testid={`categoria-${section.id}`}
                  >
                    <SectionIcon className="w-4 h-4" />
                    {section.label}
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() => (item.to ? navigate(item.to) : setActiveTab(item.id))}
                        className={`gap-2 cursor-pointer ${item.id === activeTab ? 'bg-accent font-medium' : ''}`}
                        data-testid={`acceso-${item.id}`}
                      >
                        <ItemIcon className="w-4 h-4" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>

        {/* Dónde estoy: la barra ya no muestra el acceso abierto */}
        {actual && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
            <span>{actual.section.label}</span>
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            <span className="font-medium text-foreground">{actual.item.label}</span>
          </div>
        )}

        <div className="min-w-0 w-full">
          {hasAccess(activeTab) && TAB_VIEWS[activeTab]?.()}
        </div>
      </div>
    </div>
  );
}
