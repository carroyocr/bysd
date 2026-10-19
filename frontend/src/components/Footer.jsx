import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Mail, Phone } from 'lucide-react';
import { Separator } from './ui/separator';
import { useRaceConfig } from '../contexts/RaceConfigContext';

// Pie de pagina del rediseño editorial (oct-2026): grafito sobre el sitio
// blanco, con el nombre en la condensada de los titulos.

const ICONO_SOCIAL =
  'w-10 h-10 rounded-full bg-background/10 hover:bg-primary flex items-center justify-center transition-colors text-background';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { getYear } = useRaceConfig();

  const handleLinkClick = () => {
    // ScrollToTop component handles scroll on route change
  };

  const quickLinks = [
    { href: '/faq', label: 'FAQ' },
    { href: '/encuesta', label: 'Encuesta' },
    { href: '/admin/login', label: 'Admin' },
  ];

  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 pt-2 pb-8 sm:py-16">
        <div className="max-w-[1240px] mx-auto">
          {/* Bloque principal: oculto en celular */}
          <div className="hidden sm:grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Logo and Description */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <img src="/icon-bu.png" alt="" className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-display uppercase text-2xl leading-none">Backyard Ultra</div>
                  <div className="text-xs text-background/60 font-semibold tracking-wider mt-1">
                    SANTO DOMINGO {getYear()}
                  </div>
                </div>
              </div>
              <p className="text-sm text-background/70 leading-relaxed max-w-md">
                Un desafío personal. Un ejercicio de disciplina. Una prueba de voluntad.
                Primera edición del Backyard Ultra en Santo Domingo, República Dominicana.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.instagram.com/backyardultrasantodomingo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ICONO_SOCIAL}
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.strava.com/clubs/1864664"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ICONO_SOCIAL}
                  aria-label="Strava Club"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                  </svg>
                </a>
                <a
                  href="mailto:backyardultrasantodomingo@gmail.com"
                  className={ICONO_SOCIAL}
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="font-display uppercase text-xl leading-none">Enlaces Rápidos</h3>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      onClick={handleLinkClick}
                      className="text-sm text-background/70 hover:text-background transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-display uppercase text-xl leading-none">Contacto</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-background/60 flex-shrink-0 mt-0.5" />
                  <a
                    href="mailto:backyardultrasantodomingo@gmail.com"
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    backyardultrasantodomingo@gmail.com
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-background/60 flex-shrink-0 mt-0.5" />
                  <a
                    href="tel:+18096564040"
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    +1 (809) 656-4040
                  </a>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-8 hidden sm:block bg-background/15" />

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-background/60">
            <p>
              © {currentYear} Backyard Ultra Santo Domingo. Todos los derechos reservados.
            </p>
            {/* Google Play pide que la política esté enlazada desde el sitio */}
            <Link
              to="/privacidad"
              onClick={handleLinkClick}
              className="text-sm text-background/60 hover:text-background transition-colors"
            >
              Política de Privacidad
            </Link>
            <div className="hidden sm:flex items-center gap-6">
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
