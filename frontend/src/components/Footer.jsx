import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Separator } from './ui/separator';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickLinks = [
    { href: '/evento', label: 'Evento' },
    { href: '/corredores', label: 'Corredores' },
    { href: '/voluntarios', label: 'Voluntarios' },
    { href: '/reglas', label: 'Reglas' },
    { href: '/logistica', label: 'Logística' },
    { href: '/faq', label: 'FAQ' },
  ];

  return (
    <footer className="bg-gradient-to-b from-background to-muted/30 border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Logo and Description */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-medium">
                  <span className="font-display text-2xl text-primary-foreground">BU</span>
                </div>
                <div>
                  <div className="font-display text-xl text-foreground leading-none">BACKYARD ULTRA</div>
                  <div className="text-xs text-muted-foreground font-semibold tracking-wider mt-1">
                    SANTO DOMINGO 2026
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                Un desafío personal. Un ejercicio de disciplina. Una prueba de voluntad.
                Primera edición del Backyard Ultra en Santo Domingo, República Dominicana.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.instagram.com/backyardultrasantodomingo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-muted hover:bg-primary flex items-center justify-center transition-colors group"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5 text-foreground group-hover:text-primary-foreground" />
                </a>
                <a
                  href="mailto:backyardultrasantodomingo@gmail.com"
                  className="w-10 h-10 rounded-full bg-muted hover:bg-primary flex items-center justify-center transition-colors group"
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5 text-foreground group-hover:text-primary-foreground" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground text-lg">Enlaces Rápidos</h3>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      onClick={handleLinkClick}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground text-lg">Contacto</h3>
              <div className="space-y-3">
                <a
                  href="https://maps.app.goo.gl/PswGprUy5nBqZ1di8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                    <div>Hotel Caribbean Adventure</div>
                    <div>Sierra Prieta, Santo Domingo</div>
                    <div>República Dominicana</div>
                  </div>
                </a>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <a
                    href="mailto:info@backyardultrasd.com"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    info@backyardultrasd.com
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    [Número de contacto]
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              © {currentYear} Backyard Ultra Santo Domingo. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-xs">Evento sin fines de lucro</span>
              <span className="text-xs">|</span>
              <span className="text-xs">Preservación ambiental prioritaria</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}