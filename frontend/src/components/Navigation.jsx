import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

// Race start date: January 24, 2026 at 9:00 AM (Dominican Republic time, GMT-4)
const RACE_START_DATE = new Date('2026-01-24T09:00:00-04:00');

const navLinks = [
  { href: '/evento', label: 'Evento' },
  { href: '/corredores', label: 'Corredores' },
  { href: '/voluntarios', label: 'Voluntarios' },
  { href: '/reglas', label: 'Reglas' },
  { href: '/logistica', label: 'Logística' },
  { href: '/patrocinadores', label: 'Patrocinadores' },
  { href: '/en-vivo', label: 'Seguimiento', highlightAfterRaceStart: true },
  { href: '/comunidad', label: 'Comunidad' },
  { href: '/admin/login', label: 'Admin' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if race has started
  useEffect(() => {
    const checkRaceStart = () => {
      setRaceStarted(new Date() >= RACE_START_DATE);
    };
    
    checkRaceStart();
    const timer = setInterval(checkRaceStart, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/95 backdrop-blur-md shadow-soft border-b border-border'
          : 'bg-transparent'
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
              <div className="text-xs text-muted-foreground font-semibold tracking-wider">SANTO DOMINGO 2026</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const shouldHighlight = link.highlightAfterRaceStart && raceStarted;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleLinkClick}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                    shouldHighlight
                      ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-medium animate-pulse'
                      : location.pathname === link.href
                      ? 'text-primary bg-secondary'
                      : 'text-foreground hover:text-primary hover:bg-secondary'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
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
                  {navLinks.map((link) => {
                    const shouldHighlight = link.highlightAfterRaceStart && raceStarted;
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={handleLinkClick}
                        className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                          shouldHighlight
                            ? 'bg-gradient-to-r from-primary to-accent text-white font-semibold'
                            : location.pathname === link.href
                            ? 'text-primary bg-secondary'
                            : 'text-foreground hover:text-primary hover:bg-secondary'
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}