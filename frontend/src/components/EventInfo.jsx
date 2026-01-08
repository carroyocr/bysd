import React from 'react';
import { MapPin, Clock, Calendar, Users } from 'lucide-react';
import { Card, CardContent } from './ui/card';

export default function EventInfo() {
  const infoCards = [
    {
      icon: <Calendar className="w-8 h-8 text-primary" />,
      title: 'Fecha y Hora',
      details: [
        'Sábado 24 de Enero, 2026',
        'Check-in: 6:00 AM - 7:30 AM',
        'Primera vuelta: 8:00 AM en punto',
      ],
    },
    {
      icon: <MapPin className="w-8 h-8 text-primary" />,
      title: 'Ubicación',
      details: [
        'Hotel Caribbean Adventure',
        'Sierra Prieta, Santo Domingo',
        'República Dominicana',
      ],
      link: 'https://maps.app.goo.gl/BrntZd7xFPcrmDTe7',
    },
    {
      icon: <Clock className="w-8 h-8 text-primary" />,
      title: 'Formato',
      details: [
        '6.706 km por vuelta',
        'Cada vuelta en 60 minutos o menos',
        'Inicio cada hora en punto',
      ],
    },
    {
      icon: <Users className="w-8 h-8 text-primary" />,
      title: 'Ganador',
      details: [
        'Último en pie (Last One Standing)',
        'Debe completar una vuelta más',
        'Sin tiempo límite definido',
      ],
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Información del Evento
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Todo lo que necesitas saber sobre el Backyard Ultra Santo Domingo 2026
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {infoCards.map((card, index) => (
              <Card
                key={index}
                className="hover-lift bg-card border-border shadow-soft hover:shadow-medium transition-all duration-300"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                    {card.icon}
                  </div>
                  <h3 className="font-display text-xl text-foreground">{card.title}</h3>
                  <ul className="space-y-2">
                    {card.details.map((detail, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {card.link && (
                    <a
                      href={card.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors mt-2"
                    >
                      Ver en Google Maps
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* About Backyard Ultra */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 md:p-10 space-y-6">
              <h3 className="font-display text-3xl text-foreground text-center">
                ¿Qué es un Backyard Ultra?
              </h3>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  El Backyard Ultra es más que una carrera: es un <strong className="text-foreground">desafío personal</strong>,
                  un ejercicio de <strong className="text-foreground">disciplina</strong> y una prueba de
                  <strong className="text-foreground"> voluntad</strong>. Vuelta tras vuelta.
                </p>
                <p>
                  Cada atleta debe completar un circuito de <strong className="text-foreground">6.706 km</strong> (4.167 millas)
                  en <strong className="text-foreground">60 minutos o menos</strong>. Al terminar cada vuelta, el reloj se reinicia
                  y comienza una nueva hora. Los corredores que no regresen antes de que el tiempo llegue a cero son eliminados.
                </p>
                <p>
                  El evento continúa sin tiempo límite definido, las 24 horas del día, hasta que solo quede
                  <strong className="text-foreground"> un corredor en pie</strong>. Para ganar, ese atleta debe completar
                  <strong className="text-foreground"> una vuelta adicional</strong> después de que todos los demás hayan
                  abandonado o sido eliminados.
                </p>
                <p className="text-center pt-4 text-lg font-semibold text-foreground">
                  "Solo hay un ganador: el Último en Pie (Last One Standing)"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}