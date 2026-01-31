import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const navLinks = [
  { href: '/evento', label: 'Evento' },
  { href: '/corredores', label: 'Corredores' },
  { href: '/voluntarios', label: 'Voluntarios' },
  { href: '/reglas', label: 'Reglas' },
  { href: '/logistica', label: 'Logística' },
  { href: '/patrocinadores', label: 'Patrocinadores' },
  { href: '/en-vivo', label: 'Resultados' },
  { href: '/comunidad', label: 'Comunidad' },
  { href: '/encuesta', label: 'Encuesta' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { raceCode, getYear } = useRaceConfig();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={handleLinkClick}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                  location.pathname === link.href
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
                  {navLinks.map((link) => (
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