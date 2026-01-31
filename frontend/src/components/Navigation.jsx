import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  const [expandedMobile, setExpandedMobile] = useState({ patrocinadores: false, resultados: false, comunidad: false });
  const location = useLocation();
  const { getYear } = useRaceConfig();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch all races for the dropdown
  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/all`);
        if (response.ok) {
          const data = await response.json();
          // Handle response format (races array inside object)
          const racesArray = data.races || data;
          // Filter only BYSD races (exclude test races) and sort by date descending
          const filtered = racesArray.filter(r => r.code.startsWith('BYSD-'));
          const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
          setAllRaces(sorted);
        }
      } catch (error) {
        console.error('Error fetching races:', error);
      }
    };
    fetchRaces();
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
    setExpandedMobile({ resultados: false, comunidad: false });
  };

  const toggleMobileSubmenu = (menu) => {
    setExpandedMobile(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const isPatrocinadoresActive = location.pathname.includes('/patrocinadores');
  const isResultadosActive = location.pathname.includes('/resultados') || location.pathname === '/en-vivo';
  const isComunidadActive = location.pathname.includes('/comunidad');

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
          <div className="hidden lg:flex items-center gap-0.5">
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

            {/* Patrocinadores Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 flex items-center gap-1 ${
                    isPatrocinadoresActive
                      ? 'text-primary bg-secondary'
                      : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                >
                  Patrocinadores
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {allRaces.length > 0 ? (
                  allRaces.map((race) => (
                    <DropdownMenuItem key={race.code} asChild>
                      <Link
                        to={`/patrocinadores/${race.code.toLowerCase()}`}
                        className="flex items-center justify-between w-full"
                      >
                        <span>{race.code}</span>
                        {race.is_active && (
                          <span className="w-2 h-2 rounded-full bg-green-500 ml-2" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/patrocinadores">Ver Patrocinadores</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Resultados Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 flex items-center gap-1 ${
                    isResultadosActive
                      ? 'text-primary bg-secondary'
                      : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                >
                  Resultados
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {allRaces.length > 0 ? (
                  allRaces.map((race) => (
                    <DropdownMenuItem key={race.code} asChild>
                      <Link
                        to={`/resultados/${race.code.toLowerCase()}`}
                        className="flex items-center justify-between w-full"
                      >
                        <span>{race.code}</span>
                        {race.is_active && (
                          <span className="w-2 h-2 rounded-full bg-green-500 ml-2" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/en-vivo">Ver Resultados</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Comunidad Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 flex items-center gap-1 ${
                    isComunidadActive
                      ? 'text-primary bg-secondary'
                      : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                >
                  Comunidad
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {allRaces.length > 0 ? (
                  allRaces.map((race) => (
                    <DropdownMenuItem key={race.code} asChild>
                      <Link
                        to={`/comunidad/${race.code.toLowerCase()}`}
                        className="flex items-center justify-between w-full"
                      >
                        <span>{race.code}</span>
                        {race.is_active && (
                          <span className="w-2 h-2 rounded-full bg-green-500 ml-2" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/comunidad">Ver Comunidad</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {endNavLinks.map((link) => (
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

                  {/* Mobile Patrocinadores Accordion */}
                  <div>
                    <button
                      onClick={() => toggleMobileSubmenu('patrocinadores')}
                      className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors flex items-center justify-between ${
                        isPatrocinadoresActive
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      Patrocinadores
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedMobile.patrocinadores ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedMobile.patrocinadores && (
                      <div className="ml-4 mt-1 space-y-1">
                        {allRaces.map((race) => (
                          <Link
                            key={race.code}
                            to={`/patrocinadores/${race.code.toLowerCase()}`}
                            onClick={handleLinkClick}
                            className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                              location.pathname === `/patrocinadores/${race.code.toLowerCase()}`
                                ? 'text-primary bg-secondary'
                                : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                            }`}
                          >
                            {race.code}
                            {race.is_active && (
                              <span className="ml-2 text-xs text-green-600">(Activa)</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile Resultados Accordion */}
                  <div>
                    <button
                      onClick={() => toggleMobileSubmenu('resultados')}
                      className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors flex items-center justify-between ${
                        isResultadosActive
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      Resultados
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedMobile.resultados ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedMobile.resultados && (
                      <div className="ml-4 mt-1 space-y-1">
                        {allRaces.map((race) => (
                          <Link
                            key={race.code}
                            to={`/resultados/${race.code.toLowerCase()}`}
                            onClick={handleLinkClick}
                            className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                              location.pathname === `/resultados/${race.code.toLowerCase()}`
                                ? 'text-primary bg-secondary'
                                : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                            }`}
                          >
                            {race.code}
                            {race.is_active && (
                              <span className="ml-2 text-xs text-green-600">(Activa)</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile Comunidad Accordion */}
                  <div>
                    <button
                      onClick={() => toggleMobileSubmenu('comunidad')}
                      className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors flex items-center justify-between ${
                        isComunidadActive
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:text-primary hover:bg-secondary'
                      }`}
                    >
                      Comunidad
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedMobile.comunidad ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedMobile.comunidad && (
                      <div className="ml-4 mt-1 space-y-1">
                        {allRaces.map((race) => (
                          <Link
                            key={race.code}
                            to={`/comunidad/${race.code.toLowerCase()}`}
                            onClick={handleLinkClick}
                            className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                              location.pathname === `/comunidad/${race.code.toLowerCase()}`
                                ? 'text-primary bg-secondary'
                                : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                            }`}
                          >
                            {race.code}
                            {race.is_active && (
                              <span className="ml-2 text-xs text-green-600">(Activa)</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {endNavLinks.map((link) => (
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
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
