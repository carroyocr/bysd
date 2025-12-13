import React from 'react';
import { ExternalLink, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export default function SponsorsSection() {
  const sponsors = [
    {
      name: 'AFP Atlántico',
      description: 'Referente en administración de fondos de pensiones, destacándose por su enfoque en planificación financiera y bienestar a largo plazo.',
      instagram: 'https://www.instagram.com/afpatlantico/',
    },
    {
      name: 'Águila Logistics',
      description: 'Especialistas en soluciones logísticas, reconocidos por su eficiencia y confiabilidad en operaciones de alta exigencia.',
      instagram: 'https://www.instagram.com/aguilalogisticsrd/',
    },
    {
      name: 'Banco Atlántico',
      description: 'Institución financiera líder, con una trayectoria sólida apoyando el desarrollo económico, social y deportivo del país.',
      instagram: 'https://www.instagram.com/banco_atlantico/',
    },
    {
      name: 'Ciclón',
      description: 'Bebida energetizante reconocida por acompañar el rendimiento físico en contextos de alta demanda deportiva.',
      instagram: 'https://www.instagram.com/ciclonrd/',
    },
    {
      name: 'En Simpex',
      description: 'Empresa destacada por traer al mercado dominicano una variada gama de productos de la más alta calidad, ampliando el acceso del consumidor a marcas confiables.',
      instagram: 'https://www.instagram.com/simpexrd/',
    },
    {
      name: 'Gatorade',
      description: 'Marca líder mundial en hidratación deportiva, ampliamente asociada al alto rendimiento y la resistencia.',
      instagram: 'https://www.instagram.com/gatoraderd/',
    },
    {
      name: 'General de Seguros',
      description: 'Aseguradora de referencia, enfocada en protección y prevención, clave para la seguridad de eventos deportivos.',
      instagram: 'https://www.instagram.com/generaldeseguros/',
    },
    {
      name: 'Lupa Graph',
      description: 'Estudio creativo de alto nivel, reconocido por su capacidad para construir identidades visuales sólidas y comunicación efectiva.',
      instagram: 'https://www.instagram.com/lupa_graph/',
    },
    {
      name: 'Max Sport Uniforms',
      description: 'Especialistas en indumentaria deportiva, destacados por combinar rendimiento, comodidad e identidad de marca.',
      instagram: 'https://www.instagram.com/max_sportuniforms/',
    },
    {
      name: 'Molino del Sol',
      description: 'Marca referente en alimentos, alineada con nutrición, energía y bienestar para un estilo de vida activo.',
      instagram: 'https://www.instagram.com/molinodelsolrd/',
    },
    {
      name: 'Senderitmo',
      description: 'Comunidad líder en trail running, reconocida por impulsar el crecimiento del deporte y la conexión con la naturaleza.',
      instagram: 'https://www.instagram.com/senderitmo/',
    },
    {
      name: 'Vida Sana Vida Ultra Sports Club',
      description: 'Club referente en ultra resistencia, promotor del alto rendimiento y la vida saludable en la República Dominicana.',
      instagram: 'https://www.instagram.com/vidasanavidaultra/',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Patrocinadores
            </h2>
          </div>

          {/* Introduction */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 md:p-10 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    El Backyard Ultra Santo Domingo 2026 es posible gracias al apoyo de marcas e instituciones líderes en sus respectivos sectores, que creen en el deporte, la resiliencia y el poder de la comunidad.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Cada patrocinador aporta experiencia, calidad y compromiso, haciendo posible que atletas locales e internacionales vivan una competencia segura, bien organizada y al nivel de un evento de clase mundial. Sin su apoyo, nada de esto sería posible.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-8" />

          {/* Sponsors Grid */}
          <div>
            <h3 className="font-display text-2xl text-foreground mb-6 text-center">
              Patrocinadores (orden alfabético)
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sponsors.map((sponsor, index) => (
                <Card
                  key={index}
                  className="bg-card border-border shadow-soft hover-lift hover:shadow-medium transition-all duration-300 group"
                >
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-foreground flex items-start justify-between gap-2">
                      <span>{sponsor.name}</span>
                      <a
                        href={sponsor.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        aria-label={`Instagram de ${sponsor.name}`}
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {sponsor.description}
                    </p>
                    <a
                      href={sponsor.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Ver en Instagram
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Thank You Message */}
          <Card className="bg-gradient-to-br from-secondary/30 to-muted/30 border-border shadow-medium">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">
                Gracias a Todos Nuestros Patrocinadores
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Su compromiso hace posible que este evento sea una realidad. Juntos, estamos creando
                una experiencia inolvidable para todos los atletas y la comunidad.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}