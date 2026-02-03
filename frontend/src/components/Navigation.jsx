import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ChevronRight, History } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from './ui/dropdown-menu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const staticNavLinks = [
  { href: '/evento', label: 'Evento' },
  { href: '/corredores', label: 'Corredores' },
  { href: '/voluntarios', label: 'Voluntarios' },
  { href: '/reglas', label: 'Reglas' },
  { href: '/logistica', label: 'Logística' },
];

const endNavLinks = [
  { href: '/pre-registro', label: 'Pre Registro', highlight: true },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [allRaces, setAllRaces] = useState([]);
  const [activeRace, setActiveRace] = useState(null);
  const [pastRaces, setPastRaces] = useState([]);
  const [expandedMobile, setExpandedMobile] = useState({ anteriores: false });
  const [expandedPastRace, setExpandedPastRace] = useState({});
  const [pageVisibility, setPageVisibility] = useState({ showTracking: true, showCommunity: true, showPreregistration: true });
  const [menuLogo, setMenuLogo] = useState('/icon-bu.png');
  const location = useLocation();
  const { getYear, config } = useRaceConfig();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch page visibility settings
  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/page-visibility`);
        if (response.ok) {
          const data = await response.json();
          setPageVisibility({
            showTracking: data.show_tracking_page,
            showCommunity: data.show_community_page,
            showPreregistration: data.show_preregistration !== false
          });
        }
      } catch (error) {
        console.error('Error fetching page visibility:', error);
      }
    };
    fetchVisibility();
  }, []);

  // Fetch branding (menu logo)
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/branding`);
        if (response.ok) {
          const data = await response.json();
          if (data.logo_menu_url) {
            const url = data.logo_menu_url.startsWith('/api') 
              ? `${API_URL}${data.logo_menu_url}` 
              : data.logo_menu_url;
            setMenuLogo(url);
          }
        }
      } catch (error) {
        console.error('Error fetching branding:', error);
      }
    };
    fetchBranding();
  }, []);

  // Fetch all races for the dropdown
  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/all`);
        if (response.ok) {
          const data = await response.json();
          const racesArray = data.races || data;
          const filtered = racesArray.filter(r => r.code.startsWith('BYSD-'));
          const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
          setAllRaces(sorted);
          
          // Separate active and past races
          const active = sorted.find(r => r.is_active);
          const past = sorted.filter(r => !r.is_active);
          setActiveRace(active);
          setPastRaces(past);
        }
      } catch (error) {
        console.error('Error fetching races:', error);
      }
    };
    fetchRaces();
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
    setExpandedMobile({ anteriores: false });
    setExpandedPastRace({});
  };

  const toggleMobileSubmenu = (menu) => {
    setExpandedMobile(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const togglePastRaceSubmenu = (raceCode) => {
    setExpandedPastRace(prev => ({
      ...prev,
      [raceCode]: !prev[raceCode]
    }));
  };

  // Get active race code for direct links
  const activeRaceCode = activeRace?.code?.toLowerCase() || config?.code?.toLowerCase() || 'bysd-2027';

  const isPatrocinadoresActive = location.pathname.includes('/patrocinadores');
  const isResultadosActive = location.pathname.includes('/resultados') || location.pathname === '/en-vivo';
  const isComunidadActive = location.pathname.includes('/comunidad');
  const isAnterioresActive = pastRaces.some(race => 
    location.pathname.includes(race.code.toLowerCase())
  );

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/98 backdrop-blur-md shadow-soft border-b border-border'
          : 'bg-background/90 backdrop-blur-sm border-b border-border/50'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link
            to="/"
            onClick={handleLinkClick}
            className="flex items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden shadow-medium group-hover:shadow-glow transition-all duration-300">
              <img 
                src="/icon-bu.png" 
                alt="Backyard Ultra Icon" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden md:block">
              <div className="font-display text-xl text-foreground leading-none">BACKYARD ULTRA</div>
              <div className="text-xs text-muted-foreground font-semibold tracking-wider">SANTO DOMINGO {getYear()}</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {staticNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={handleLinkClick}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
                  location.pathname === link.href
                    ? 'text-primary bg-secondary'
                    : 'text-foreground hover:text-primary hover:bg-secondary'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Direct link to active race Patrocinadores */}
            <Link
              to={`/patrocinadores/${activeRaceCode}`}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
                isPatrocinadoresActive && location.pathname.includes(activeRaceCode)
                  ? 'text-primary bg-secondary'
                  : 'text-foreground hover:text-primary hover:bg-secondary'
              }`}
            >
              Patrocinadores
            </Link>

            {/* Direct link to active race Resultados - Only show if tracking page is enabled */}
            {pageVisibility.showTracking && (
              <Link
                to={`/resultados/${activeRaceCode}`}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
                  isResultadosActive && location.pathname.includes(activeRaceCode)
                    ? 'text-primary bg-secondary'
                    : 'text-foreground hover:text-primary hover:bg-secondary'
                }`}
              >
                Resultados
              </Link>
            )}

            {/* Direct link to active race Comunidad - Only show if community page is enabled */}
            {pageVisibility.showCommunity && (
              <Link
                to={`/comunidad/${activeRaceCode}`}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
                  isComunidadActive && location.pathname.includes(activeRaceCode)
                    ? 'text-primary bg-secondary'
                    : 'text-foreground hover:text-primary hover:bg-secondary'
                }`}
              >
                Comunidad
              </Link>
            )}

            {/* Anteriores Dropdown - Only show if there are past races */}
            {pastRaces.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 flex items-center gap-1 ${
                      isAnterioresActive
                        ? 'text-primary bg-secondary'
                        : 'text-foreground hover:text-primary hover:bg-secondary'
                    }`}
                  >
                    <History className="w-3 h-3" />
                    Anteriores
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[180px]">
                  {pastRaces.map((race) => (
                    <DropdownMenuSub key={race.code}>
                      <DropdownMenuSubTrigger className="flex items-center justify-between">
                        <span>{race.code}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="min-w-[140px]">
                          <DropdownMenuItem asChild>
                            <Link to={`/patrocinadores/${race.code.toLowerCase()}`}>
                              Patrocinadores
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/resultados/${race.code.toLowerCase()}`}>
                              Resultados
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/comunidad/${race.code.toLowerCase()}`}>
                              Comunidad
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {endNavLinks.map((link) => (
              // Hide Pre Registro link if preregistration is disabled
              link.href === '/pre-registro' && !pageVisibility.showPreregistration ? null : (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleLinkClick}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 whitespace-nowrap ${
                    link.highlight
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : location.pathname === link.href
                        ? 'text-primary bg-secondary'
                        : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px] flex flex-col">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img 
                    src="/icon-bu.png" 
                    alt="Backyard Ultra Icon" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-display text-lg text-foreground leading-none">BACKYARD ULTRA</div>
                  <div className="text-xs text-muted-foreground font-semibold">SANTO DOMINGO</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-6">
                <div className="flex flex-col gap-2 pr-2">
                  {staticNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={handleLinkClick}
                      className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                        location.pathname === link.href
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {/* Direct links to active race pages */}
                  <Link
                    to={`/patrocinadores/${activeRaceCode}`}
                    onClick={handleLinkClick}
                    className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                      isPatrocinadoresActive && location.pathname.includes(activeRaceCode)
                        ? 'text-primary bg-secondary'
                        : 'text-foreground hover:text-primary hover:bg-secondary'
                    }`}
                  >
                    Patrocinadores
                  </Link>

                  {pageVisibility.showTracking && (
                    <Link
                      to={`/resultados/${activeRaceCode}`}
                      onClick={handleLinkClick}
                      className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                        isResultadosActive && location.pathname.includes(activeRaceCode)
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      Resultados
                    </Link>
                  )}

                  {pageVisibility.showCommunity && (
                    <Link
                      to={`/comunidad/${activeRaceCode}`}
                      onClick={handleLinkClick}
                      className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                        isComunidadActive && location.pathname.includes(activeRaceCode)
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      Comunidad
                    </Link>
                  )}

                  {/* Mobile Anteriores Accordion - Only show if there are past races */}
                  {pastRaces.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleMobileSubmenu('anteriores')}
                        className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors flex items-center justify-between ${
                          isAnterioresActive
                            ? 'text-primary bg-secondary'
                            : 'text-foreground hover:text-primary hover:bg-secondary'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Anteriores
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedMobile.anteriores ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedMobile.anteriores && (
                        <div className="ml-4 mt-1 space-y-1">
                          {pastRaces.map((race) => (
                            <div key={race.code}>
                              <button
                                onClick={() => togglePastRaceSubmenu(race.code)}
                                className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                                  location.pathname.includes(race.code.toLowerCase())
                                    ? 'text-primary bg-secondary/70'
                                    : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                                }`}
                              >
                                {race.code}
                                <ChevronRight className={`w-3 h-3 transition-transform ${expandedPastRace[race.code] ? 'rotate-90' : ''}`} />
                              </button>
                              {expandedPastRace[race.code] && (
                                <div className="ml-4 mt-1 space-y-1">
                                  <Link
                                    to={`/patrocinadores/${race.code.toLowerCase()}`}
                                    onClick={handleLinkClick}
                                    className="block px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/30"
                                  >
                                    Patrocinadores
                                  </Link>
                                  <Link
                                    to={`/resultados/${race.code.toLowerCase()}`}
                                    onClick={handleLinkClick}
                                    className="block px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/30"
                                  >
                                    Resultados
                                  </Link>
                                  <Link
                                    to={`/comunidad/${race.code.toLowerCase()}`}
                                    onClick={handleLinkClick}
                                    className="block px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/30"
                                  >
                                    Comunidad
                                  </Link>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {endNavLinks.map((link) => (
                    // Hide Pre Registro link if preregistration is disabled
                    link.href === '/pre-registro' && !pageVisibility.showPreregistration ? null : (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={handleLinkClick}
                        className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                          location.pathname === link.href
                            ? 'text-primary bg-secondary'
                            : 'text-foreground hover:text-primary hover:bg-secondary'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
