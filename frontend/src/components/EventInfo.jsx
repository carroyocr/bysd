import React from 'react';
import { MapPin, Clock, Calendar, Users } from 'lucide-react';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import FotoAlbum from './FotoAlbum';
import { FOTOS_EVENTO } from '../content/portada';

// Pagina del evento en el rediseño editorial (oct-2026): los cuatro datos van
// en columnas separadas por filetes, sin tarjetas, y la explicacion del
// formato cierra con tres fotos de la edicion anterior con su pie.

const Eyebrow = ({ children }) => (
  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{children}</div>
);

export default function EventInfo() {
  const { getShortDate, raceName, raceLocation } = useRaceConfig();

  const infoCards = [
    {
      icon: Calendar,
      title: 'Fecha y Hora',
      details: [
        getShortDate(),
        'Check-in: 6:00 AM - 7:30 AM',
        'Primera vuelta: 8:00 AM en punto',
      ],
    },
    {
      icon: MapPin,
      title: 'Ubicación',
      details: [
        'Hotel Caribbean Adventure',
        raceLocation,
      ].filter(Boolean),
      link: 'https://maps.app.goo.gl/BrntZd7xFPcrmDTe7',
    },
    {
      icon: Clock,
      title: 'Formato',
      details: [
        '6.706 km por vuelta',
        'Cada vuelta en 60 minutos o menos',
        'Inicio cada hora en punto',
      ],
    },
    {
      icon: Users,
      title: 'Ganador',
      details: [
        'Último en pie (Last One Standing)',
        'Debe completar una vuelta más',
        'Sin tiempo límite definido',
      ],
    },
  ];

  return (
    <>
      <section className="py-16 sm:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-[1240px] mx-auto">
            <Eyebrow>Evento</Eyebrow>
            <h2 className="font-display uppercase text-5xl sm:text-7xl leading-none tracking-tight text-foreground mt-3">
              Información del Evento
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mt-4">
              Todo lo que necesitas saber sobre el {raceName}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mt-14 pt-10 border-t border-border">
              {infoCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title}>
                    <Icon className="w-7 h-7 text-primary mb-5" />
                    <h3 className="font-display uppercase text-3xl leading-none text-foreground mb-3">{card.title}</h3>
                    <ul>
                      {card.details.map((detail) => (
                        <li key={detail} className="text-[15px] text-muted-foreground py-1.5 border-b border-border">
                          {detail}
                        </li>
                      ))}
                    </ul>
                    {card.link && (
                      <a
                        href={card.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-4 text-sm font-semibold text-primary border-b-[1.5px] border-primary hover:text-foreground hover:border-foreground transition-colors"
                      >
                        Ver en Google Maps
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-[1240px] mx-auto">
            <div className="max-w-3xl mx-auto text-center">
              <Eyebrow>El formato</Eyebrow>
              <h3 className="font-display uppercase text-5xl sm:text-7xl leading-none tracking-tight text-foreground mt-3">
                ¿Qué es un Backyard Ultra?
              </h3>
              <div className="text-left space-y-5 text-lg text-foreground/80 leading-relaxed mt-8">
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
              </div>
              <blockquote className="font-display uppercase text-4xl sm:text-5xl leading-none text-primary mt-10 mb-16">
                “Solo hay un ganador: el Último en Pie (Last One Standing)”
              </blockquote>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {FOTOS_EVENTO.map((foto) => (
                <figure key={foto.clave}>
                  <FotoAlbum foto={foto} ancho={1000} className="w-full aspect-[4/3] object-cover" />
                  <figcaption className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {foto.pie}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
