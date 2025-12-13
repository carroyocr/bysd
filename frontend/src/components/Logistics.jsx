import React from 'react';
import { MapPin, Bed, Utensils, Car, Tent, Droplet, TreePine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export default function Logistics() {
  const facilities = [
    {
      icon: <MapPin className="w-6 h-6" />,
      title: 'Ubicación',
      items: [
        'Hotel Caribbean Adventure',
        'Finca del Grupo Alonso',
        'Sierra Prieta, Santo Domingo',
        'Circuito cerrado y controlado',
      ],
      link: 'https://maps.app.goo.gl/PswGprUy5nBqZ1di8',
    },
    {
      icon: <Car className="w-6 h-6" />,
      title: 'Estacionamiento',
      items: [
        'Estacionamiento seguro y gratuito',
        'Disponible en la propiedad',
        'Capacidad amplia',
        'Vigilancia 24/7',
      ],
    },
    {
      icon: <Tent className="w-6 h-6" />,
      title: 'Zona de Camping',
      items: [
        'Espacio asignado de 4m x 4m por atleta',
        'Carpas solo en áreas marcadas',
        'No bloquear pasillos',
        'Área cubierta compartida (Rancho) de 600 m²',
      ],
    },
    {
      icon: <Bed className="w-6 h-6" />,
      title: 'Alojamiento',
      items: [
        'Hotel disponible para acompañantes',
        'Reserva previa requerida',
        'Piscina y áreas verdes',
        'Actividades recreativas disponibles',
      ],
    },
    {
      icon: <Utensils className="w-6 h-6" />,
      title: 'Alimentación',
      items: [
        'Almuerzo buffet disponible',
        'Costo: RD$550.00 por persona',
        'Snacks y frutas en línea de meta',
        'Se recomienda llevar alimentos propios',
      ],
    },
    {
      icon: <Droplet className="w-6 h-6" />,
      title: 'Hidratación',
      items: [
        'Agua potable en área de evento',
        'Bebidas isotónicas en meta',
        'Solo disponible en salida/meta',
        'Llevar sistema de hidratación personal',
      ],
    },
  ];

  const bathrooms = [
    '4 baños en el Rancho (zona cubierta)',
    '4 baños portátiles distribuidos en el sitio',
    'Mantenimiento regular durante el evento',
    'Puntos de agua potable en áreas específicas',
  ];

  const activities = [
    { name: 'Four Wheel Parejas', price: 'RD$ 2,738.00' },
    { name: 'Go Karts Offroad', price: 'RD$ 890.00' },
    { name: 'Karting Inroad', price: 'RD$ 1,780.00' },
    { name: 'Mario Karts', price: 'RD$ 1,711.00' },
    { name: 'Kayak 1 Pax', price: 'RD$ 890.00' },
    { name: 'Paseo en Tren', price: 'RD$ 275.00' },
    { name: 'Zipline', price: 'RD$ 548.00' },
    { name: 'Tour Apiario', price: 'RD$ 821.00' },
    { name: 'Cabalgatas', price: 'RD$ 342.00' },
  ];

  const supportCrew = [
    'Acompañantes y equipo de apoyo permitidos en áreas sociales',
    'Áreas designadas: zona de carpas o Rancho',
    'NO pueden ingresar al circuito',
    'NO pueden correr con los atletas o caminar el circuito',
    'Deben respetar áreas delimitadas',
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Instalaciones y Servicios
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Todo lo que necesitas saber sobre las instalaciones del evento
            </p>
          </div>

          {/* Main Facilities */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((facility, index) => (
              <Card key={index} className="border-border shadow-soft hover-lift">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {facility.icon}
                  </div>
                  <CardTitle>{facility.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {facility.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {facility.link && (
                    <a
                      href={facility.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors mt-4"
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

          {/* Bathrooms and Water */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Droplet className="w-6 h-6 text-primary" />
                Baños y Agua Potable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {bathrooms.map((item, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Importante:</strong> Los atletas son responsables
                    de mantener su área limpia y organizada. Puntos de eliminación de basura disponibles
                    en todo el sitio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Crew */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TreePine className="w-6 h-6 text-primary" />
                Acompañantes y Equipo de Apoyo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {supportCrew.map((rule, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                    <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                    <span className="text-foreground">{rule}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hotel Activities */}
          <Card className="bg-gradient-to-br from-secondary/30 to-muted/30 border-border shadow-medium">
            <CardHeader>
              <CardTitle className="text-2xl">Actividades Recreativas del Hotel</CardTitle>
              <p className="text-sm text-muted-foreground">
                Actividades disponibles con costo adicional en el hotel y cercanías
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 p-4 rounded-lg bg-card border border-border hover-lift"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TreePine className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{activity.name}</span>
                    </div>
                    <Badge variant="outline" className="font-semibold text-primary">
                      {activity.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5 shadow-soft">
              <CardContent className="p-6 space-y-3">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Reconocimiento del Circuito
                </h4>
                <p className="text-sm text-muted-foreground">
                  Se recomienda previsualizar el circuito el día anterior, solo cuando esté autorizado
                  por la organización. Esta previsión debe hacerse a pie, sin alterar señalización
                  o acceder a áreas delimitadas.
                </p>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-accent/5 shadow-soft">
              <CardContent className="p-6 space-y-3">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <TreePine className="w-5 h-5 text-accent" />
                  Evento sin Fines de Lucro
                </h4>
                <p className="text-sm text-muted-foreground">
                  Este evento es sin fines de lucro. La preservación ambiental es una prioridad.
                  El Hotel Caribbean Adventure ofrece un ambiente natural privilegiado para una
                  experiencia segura, desafiante y memorable.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Control Points */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-2xl">Puntos de Control y Seguridad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  El circuito cuenta con inspecciones periódicas y personal de apoyo en ubicaciones
                  clave para supervisión y asistencia en emergencias.
                </p>
                <div className="grid md:grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="font-display text-3xl text-primary mb-2">2</div>
                    <div className="text-sm text-muted-foreground">Puntos de Control</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="font-display text-3xl text-primary mb-2">150</div>
                    <div className="text-sm text-muted-foreground">Banderas de Señalización</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="font-display text-3xl text-primary mb-2">24/7</div>
                    <div className="text-sm text-muted-foreground">Supervisión y Apoyo</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-4">
                  <strong className="text-foreground">Nota:</strong> Los corredores que observen anomalías
                  deben reportar al personal.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}