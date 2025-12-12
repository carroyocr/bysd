import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

const navLinks = [
  { href: '#evento', label: 'Evento' },
  { href: '#corredores', label: 'Corredores' },
  { href: '#voluntarios', label: 'Voluntarios' },
  { href: '#reglas', label: 'Reglas' },
  { href: '#logistica', label: 'Logística' },
  { href: '#faq', label: 'FAQ' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, href) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      setIsOpen(false);
    }
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
          <a
            href="#hero"
            onClick={(e) => scrollToSection(e, '#hero')}
            className="flex items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-medium group-hover:shadow-glow transition-all duration-300">
              <span className="font-display text-2xl text-primary-foreground">BU</span>
            </div>
            <div className="hidden md:block">
              <div className="font-display text-xl text-foreground leading-none">BACKYARD ULTRA</div>
              <div className="text-xs text-muted-foreground font-semibold tracking-wider">SANTO DOMINGO 2026</div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <span className="font-display text-2xl text-primary-foreground">BU</span>
                  </div>
                  <div>
                    <div className="font-display text-lg text-foreground leading-none">BACKYARD ULTRA</div>
                    <div className="text-xs text-muted-foreground font-semibold">SANTO DOMINGO</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.href)}
                      className="px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                    >
                      {link.label}
                    </a>
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