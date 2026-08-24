import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  LogOut, Settings, ClipboardList, Users, ChevronLeft, ChevronDown, Flag, UserPlus,
  Building2, CalendarClock, ClipboardCheck, Wallet, Shield, Mail, Clock,
  Trophy, Send, Shirt, GraduationCap, MessageCircle, Medal, Newspaper, Megaphone,
  Bell, Radio, Eye, ShieldAlert
} from 'lucide-react';
import RaceControlPanel from '../components/RaceControlPanel';
import SurveyResultsSection from '../components/SurveyResultsSection';
import RaceConfigPanel from '../components/RaceConfigPanel';
import PreRegistrationManagement from '../components/PreRegistrationManagement';
import SponsorsManagement from '../components/SponsorsManagement';
import AdsManagement from '../components/AdsManagement';
import VolunteerConfigManagement from '../components/VolunteerConfigManagement';
import VolunteerAssignmentsManagement from '../components/VolunteerAssignmentsManagement';
import VolunteerProfilesManagement from '../components/VolunteerProfilesManagement';
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
import CheerModerationPanel from '../components/CheerModerationPanel';
import EspectadoresManagement from '../components/EspectadoresManagement';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
// El selector de carrera no va aquí arriba, sino dentro de En Vivo: es lo único
// que se trabaja sobre una carrera concreta. El resto del panel (inscripciones,
// patrocinadores, finanzas, voluntarios) es de la carrera publicada, y un
// selector global obligaría a cambiarlo dos veces: la semana del campeonato se
// lleva el control de vueltas del campeonato mientras las inscripciones siguen
// siendo las de enero. El proveedor sí envuelve todo el panel, para que Control
// y Vueltas compartan la carrera elegida.
import { AdminRaceProvider } from '../contexts/AdminRaceContext';
import { cerrarSesion } from '../lib/sesion';
import { token as sesionToken } from '../lib/sesion';

// Permisos que abren cada tab: el primero es el permiso propio del tab y el
// segundo el permiso "sombrilla" histórico de su grupo (sigue valiendo).
const TAB_PERMISSIONS = {
  // Control y registro de vueltas son una sola pantalla: abre quien pueda
  // entrar a cualquiera de las dos partes, y dentro se le ensena la suya.
  'control': ['race-control', 'laps', 'control'],
  'lap-registry': ['laps', 'control'],
  // Tambien lo abre quien lleva las comunicaciones: es el mismo trabajo
  // que el envio de correos, con otro canal.
  'app-avisos': ['app-avisos', 'control', 'emails'],
  // Los reportados los revisa quien esta en el control de la carrera: el
  // backend los protege con el permiso "control" y sus permisos por tab.
  'animos': ['race-control', 'laps', 'app-avisos', 'control'],
  'registrations': ['registrations', 'athletes'],
  'finances': ['finances'],
  'volunteers': ['shifts', 'volunteers'],
  'assignments': ['assignments', 'volunteers'],
  'volunteer-profiles': ['volunteer-profiles', 'volunteers'],
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
  // La lista de espectadores sirve para escribirles: va con comunicaciones.
  'espectadores': ['espectadores', 'emails'],
  'tshirt': ['tshirt', 'config'],
  'capacitaciones': ['capacitaciones', 'config'],
  'seleccionados': ['seleccionados', 'athletes'],
  'prensa': ['prensa', 'emails'],
};

const canOpenTab = (permissions, tabId) =>
  (TAB_PERMISSIONS[tabId] || []).some((p) => permissions.includes(p));

// Categorías de la barra superior. Cada una agrupa los accesos de un área de
// trabajo; el orden aquí es el que se ve y también el que decide a qué sección
// cae un usuario que no tiene permiso para la que pidió.
// El escáner QR no está: se escanea desde la app, no desde el panel web.
const ADMIN_SECTIONS = [
  {
    id: 'en-vivo',
    label: 'En Vivo',
    icon: Radio,
    items: [
      { id: 'control', label: 'Control de Carrera', icon: Radio },
      { id: 'animos', label: 'Ánimos Reportados', icon: ShieldAlert },
    ],
  },
  {
    id: 'atletas',
    label: 'Atletas',
    icon: UserPlus,
    items: [
      { id: 'registrations', label: 'Inscripciones', icon: UserPlus },
      { id: 'athlete-profiles', label: 'Perfiles', icon: Users },
      { id: 'results-2026', label: 'Resultados', icon: Trophy },
      { id: 'seleccionados', label: 'Seleccionados', icon: Medal },
      { id: 'tshirt', label: 'Camisetas', icon: Shirt },
      { id: 'capacitaciones', label: 'Actividades', icon: GraduationCap },
    ],
  },
  {
    id: 'voluntarios',
    label: 'Voluntarios',
    icon: ClipboardCheck,
    items: [
      { id: 'assignments', label: 'Voluntarios', icon: ClipboardCheck },
      { id: 'volunteer-profiles', label: 'Perfiles', icon: Users },
      { id: 'volunteers', label: 'Turnos', icon: CalendarClock },
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
      { id: 'app-avisos', label: 'Mensajes App', icon: Bell },
      { id: 'espectadores', label: 'Espectadores', icon: Eye },
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
      { id: 'emails', label: 'Plantillas de Correo', icon: Mail },
      { id: 'surveys', label: 'Encuesta', icon: ClipboardList },
    ],
  },
];

// Accesos en el orden de la barra.
const TAB_ORDER = ADMIN_SECTIONS.flatMap((s) => s.items.map((i) => i.id));

const findItem = (tabId, secciones = ADMIN_SECTIONS) => {
  for (const section of secciones) {
    const item = section.items.find((i) => i.id === tabId);
    if (item) return { section, item };
  }
  return null;
};

// Vista de cada acceso. Son funciones a nivel de módulo (no componentes
// definidos dentro del render) para que el contenido no se remonte solo.
const TAB_VIEWS = {
  'control': (permisos) => (
    <RaceControlPanel
      puedeControlar={permisos.control}
      puedeVerVueltas={permisos.vueltas}
    />
  ),
  'app-avisos': () => <PushComposer />,
  'animos': () => <CheerModerationPanel />,
  'espectadores': () => <EspectadoresManagement />,
  'registrations': () => <PreRegistrationManagement />,
  'athlete-profiles': () => <AthleteProfilesManagement />,
  'results-2026': () => <ClaimedResultsManagement />,
  'seleccionados': () => <SeleccionadosManagement />,
  'tshirt': () => <TshirtManagement />,
  'assignments': () => <VolunteerAssignmentsManagement />,
  'volunteer-profiles': () => <VolunteerProfilesManagement />,
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
    const token = sesionToken();
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

        // Quien solo escanea no tiene nada que abrir en el panel: va derecho a
        // /scan. El escáner ya no está en la barra, pero este atajo se queda
        // porque si no estas cuentas entran a un panel vacío.
        const hasOnlyScanner = permissions.length === 1 && permissions[0] === 'scanner';
        if (hasOnlyScanner && !isAdminUser) {
          navigate('/scan');
          return;
        }

        // Set initial tab based on permissions
        // El registro de vueltas dejo de ser un acceso propio y vive dentro de
        // Control; los enlaces guardados siguen llevando alli.
        const pedido = searchParams.get('tab') || 'control';
        const requestedTab = pedido === 'lap-registry' ? 'control' : pedido;
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
    if (!activeTab) return;
    // Conservando lo que ya hubiera en la URL: si se reemplaza entera, cambiar
    // de sección borraría la carrera elegida y el panel saltaría a otra.
    setSearchParams((previos) => {
      if (previos.get('tab') === activeTab) return previos;
      const siguiente = new URLSearchParams(previos);
      siguiente.set('tab', activeTab);
      return siguiente;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  // Si el usuario tiene alguno de estos permisos
  const puedeVer = (permisos) =>
    isAdmin || userPermissions.includes('all') || permisos.some((p) => userPermissions.includes(p));

  // Check if user has access to a specific tab
  const hasAccess = (tabId) => {
    if (isAdmin) return true;
    if (userPermissions.includes('all')) return true;

    return canOpenTab(userPermissions, tabId);
  };

  const handleLogout = () => {
    cerrarSesion();
    navigate('/admin/login');
  };

  if (!isAuthenticated || !activeTab) {
    return null;
  }

  // Una categoría solo se muestra si el usuario puede entrar a algo dentro
  const visibleSections = ADMIN_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => hasAccess(i.id)) }))
    .filter((section) => section.items.length > 0);

  const actual = findItem(activeTab, visibleSections);

  return (
    <AdminRaceProvider>
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

            // Una categoría con un solo acceso no necesita desplegarse: sería
            // un clic de más para llegar siempre al mismo sitio. Pasa con En
            // Vivo, y también con cualquier otra a la que los permisos del
            // usuario le dejen un único acceso visible.
            if (section.items.length === 1) {
              const unico = section.items[0];
              return (
                <Button
                  key={section.id}
                  variant={isCurrent ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setActiveTab(unico.id)}
                  data-testid={`categoria-${section.id}`}
                >
                  <SectionIcon className="w-4 h-4" />
                  {section.label}
                </Button>
              );
            }

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
                        onSelect={() => setActiveTab(item.id)}
                        className={`gap-2 cursor-pointer ${
                          item.id === activeTab
                            ? 'bg-accent text-accent-foreground font-medium'
                            : ''
                        }`}
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
        {actual && actual.section.items.length > 1 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
            <span>{actual.section.label}</span>
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            <span className="font-medium text-foreground">{actual.item.label}</span>
          </div>
        )}

        <div className="min-w-0 w-full">
          {hasAccess(activeTab) && TAB_VIEWS[activeTab]?.({
            // Control de Carrera junta dos partes que antes eran accesos
            // distintos; cada usuario ve la que su permiso le abre.
            control: puedeVer(['race-control', 'control']),
            vueltas: puedeVer(['laps', 'control']),
          })}
        </div>
      </div>
    </div>
    </AdminRaceProvider>
  );
}
