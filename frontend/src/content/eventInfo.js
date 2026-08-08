/**
 * Contenido editorial del evento (reglas, logística y preguntas frecuentes).
 * Lo consumen las páginas del sitio (components/Rules, Logistics, FAQ) y las
 * pantallas de BYSD Live, para que ambos muestren exactamente lo mismo.
 */

export const REGLAS = {
  formato: [
    'Circuito de 6.706 km (4.167 millas) por vuelta',
    'Cada vuelta debe completarse en 60 minutos o menos',
    'Todas las vueltas comienzan puntualmente al inicio de cada hora',
    'Tres llamadas antes de iniciar: 3 minutos, 2 minutos y 1 minuto',
    'Los corredores deben estar dentro del corral al inicio',
  ],
  obligatorias: [
    'Los corredores que no regresen antes de que el tiempo llegue a cero son eliminados',
    'No se puede iniciar una vuelta antes de que el reloj oficial comience',
    'Las vueltas deben completarse únicamente por el atleta (sin acompañantes)',
    'No se permite compañía, bicicletas, mascotas o cualquier otro tipo de ayuda en el circuito',
    'Los corredores pueden descansar, hidratarse y comer en el área de meta entre vueltas',
  ],
  prohibiciones: [
    'Consumo de alcohol durante la competencia',
    'Correr con dolor intenso, mareos, juicio alterado o agotamiento extremo',
    'Conducta ofensiva, agresiva, irrespetuosa o discriminatoria',
    'Interferir con el rendimiento o área de descanso de otros corredores',
    'Tirar basura en el circuito o áreas comunes',
    'Alterar vegetación, fauna o estructuras naturales',
    'Hacer fogatas',
    'Tomar atajos o cortar camino',
  ],
  ganador: [
    'Solo hay un ganador: el "Último en Pie" (Last One Standing)',
    'El ganador es el último corredor en completar una vuelta válida',
    'Para ganar, el atleta debe completar una vuelta adicional después de que todos los demás hayan abandonado o sido eliminados',
    'Si no se completa esta última vuelta, no hay ganador',
  ],
  deportividad: [
    'Mantener actitud respetuosa hacia atletas, voluntarios, personal, acompañantes y público',
    'Se espera deportividad ejemplar y apoyo saludable entre participantes',
    'Cualquier conflicto debe reportarse al Comité Organizador',
    'Moderar volumen de música y conversación en área de carpas',
    'Los atletas que decidan retirarse deben notificar al personal en la línea de meta',
    'No se permite reingreso después del retiro',
    'Los corredores no pueden permanecer en el corral durante vueltas posteriores',
  ],
  ambiental: [
    'Toda la basura debe ser traída de vuelta al área de meta',
    'Puntos de eliminación de basura estarán disponibles, pero no se permite basura en carpas ni en el circuito',
    'Respetar áreas de camping designadas',
    'El incumplimiento puede llevar a descalificación inmediata',
  ],
  senalizacion: [
    '150 banderas cada 40 metros',
    'Material reflectante en banderas',
    'Señales adicionales en puntos clave',
    'Cinta/marcadores en giros',
  ],
  terreno: [
    'Tierra compactada',
    'Áreas sombreadas y expuestas',
    'Tramos amplios para ritmo consistente',
    'Curvas suaves, no técnico',
  ],
};

/** Enlace oficial en Google Maps de la sede del evento. */
export const SEDE_MAPS_URL = 'https://maps.app.goo.gl/BrntZd7xFPcrmDTe7';

/**
 * Enlace de mapa para el lugar de una carrera: usa el enlace oficial cuando
 * la sede es el Hotel Caribbean Adventure y, si no, busca el texto del lugar
 * en Google Maps (así funciona también para sedes futuras).
 */
export function mapsUrlDe(location) {
  if (!location) return null;
  if (/caribbean\s+adventure/i.test(location)) return SEDE_MAPS_URL;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

// icon: nombre del ícono de lucide-react; cada consumidor lo resuelve.
export const LOGISTICA = {
  instalaciones: [
    {
      icon: 'MapPin',
      title: 'Ubicación',
      items: [
        'Hotel Caribbean Adventure',
        'Sierra Prieta, Santo Domingo',
        'Circuito cerrado y controlado',
      ],
      link: 'https://maps.app.goo.gl/BrntZd7xFPcrmDTe7',
    },
    {
      icon: 'Car',
      title: 'Estacionamiento',
      items: [
        'Estacionamiento seguro y gratuito',
        'Disponible en la propiedad',
        'Capacidad amplia',
        'Vigilancia 24/7',
      ],
    },
    {
      icon: 'Tent',
      title: 'Zona de Camping',
      items: [
        'Espacio asignado de 4m x 4m por atleta',
        'Carpas solo en áreas marcadas',
        'No bloquear pasillos',
      ],
    },
    {
      icon: 'Bed',
      title: 'Alojamiento',
      items: [
        'Hotel disponible para acompañantes',
        'Reserva previa requerida',
        'Piscina y áreas verdes',
        'Actividades recreativas disponibles',
      ],
    },
    {
      icon: 'Utensils',
      title: 'Alimentación',
      items: [
        'Foodtruck Disponible',
        'Snacks y frutas en línea de meta',
        'Se recomienda llevar alimentos propios',
      ],
    },
    {
      icon: 'Droplet',
      title: 'Hidratación',
      items: [
        'Agua potable en área de evento',
        'Bebidas isotónicas en meta',
        'Solo disponible en salida/meta',
        'Llevar sistema de hidratación personal',
      ],
    },
  ],
  banos: [
    '4 baños portátiles distribuidos en el sitio',
    'Mantenimiento regular durante el evento',
    'Puntos de agua potable en áreas específicas',
  ],
  acompanantes: [
    'Acompañantes y equipo de apoyo permitidos en áreas sociales',
    'Áreas designadas: zona de carpas o Rancho',
    'NO pueden ingresar al circuito',
    'NO pueden correr con los atletas o caminar el circuito',
    'Deben respetar áreas delimitadas',
  ],
};

export const FAQS = [
  {
    question: '¿Qué es un Backyard Ultra?',
    answer:
      'Es una carrera de resistencia donde los corredores deben completar un circuito de 6.706 km cada hora. Cada vuelta comienza al inicio de la hora, y los atletas que no completen la vuelta a tiempo son eliminados. El evento continúa hasta que solo quede un corredor en pie.',
  },
  {
    question: '¿Cómo se determina el ganador?',
    answer:
      'Solo hay un ganador: el "Último en Pie" (Last One Standing). Para ganar, el atleta debe completar una vuelta adicional después de que todos los demás hayan abandonado o sido eliminados. Si no se completa esta última vuelta, no hay ganador.',
  },
  {
    question: '¿Cuánto tiempo puede durar el evento?',
    answer:
      'No hay tiempo límite definido. El evento continúa las 24 horas del día mientras haya más de un atleta activo. Puede durar 12 horas, 24 horas, 48 horas o más, dependiendo de la resistencia de los participantes.',
  },
  {
    question: '¿Qué sucede si llego tarde al inicio de una vuelta?',
    answer:
      'Si no estás dentro del corral de salida cuando el tiempo llega a cero (al inicio de la hora), serás eliminado inmediatamente. La puntualidad es absolutamente crítica en este formato.',
  },
  {
    question: '¿Puedo correr acompañado o con mi mascota?',
    answer:
      'No. No se permite compañía, bicicletas, mascotas o cualquier otro tipo de ayuda en el circuito. Las vueltas deben completarse únicamente por el atleta de forma individual.',
  },
  {
    question: '¿Dónde puedo descansar entre vueltas?',
    answer:
      'Puedes descansar, hidratarte y comer en el área designada de meta/salida entre vueltas. Cada atleta tiene un espacio asignado de 4m x 4m para carpas personales, o puedes usar el área cubierta compartida (Carpa) de 300 m².',
  },
  {
    question: '¿Hay puntos de hidratación en el circuito?',
    answer:
      'No. La hidratación oficial está disponible exclusivamente en la línea de salida/meta. Debes llevar tu propio sistema de hidratación personal (botella o soft flask) si necesitas agua durante el circuito.',
  },
  {
    question: '¿Qué equipo es obligatorio?',
    answer:
      'Equipo obligatorio: linterna frontal con batería para al menos 8 horas, luz trasera roja visible, contenedor de hidratación personal, calzado apropiado para suelo blando y grava, e identificación personal.',
  },
  {
    question: '¿Puedo retirarme y volver a entrar?',
    answer:
      'No. Una vez que te retires voluntariamente y notifiques al personal, no puedes reingresar a la competencia. Además, no puedes permanecer en el corral o área de salida durante vueltas posteriores.',
  },
  {
    question: '¿Qué pasa si necesito asistencia médica?',
    answer:
      'Personal médico estará presente las 24 horas, incluyendo paramédicos certificados y ambulancia. Si tienes una emergencia, dirígete inmediatamente a la línea de meta donde se encuentra el equipo médico, o notifica al corredor más cercano.',
  },
  {
    question: '¿Hay estacionamiento y alojamiento disponible?',
    answer:
      'Sí. Hay estacionamiento seguro y gratuito en la propiedad. También hay zona de camping disponible. El hotel ofrece alojamiento para acompañantes con reserva previa.',
  },
  {
    question: '¿Qué es la política de basura?',
    answer:
      'Se aplica estrictamente la política "Leave No Trace". Cada atleta es responsable de su propia basura. No se permite basura en carpas ni en el circuito. El incumplimiento puede llevar a descalificación inmediata.',
  },
  {
    question: '¿Puedo usar alcohol durante el evento?',
    answer:
      'No. El consumo de alcohol está estrictamente prohibido durante la competencia. Esta regla se aplica tanto a corredores como a voluntarios.',
  },
  {
    question: '¿Cómo es el terreno del circuito?',
    answer:
      'El circuito es de tierra compactada con áreas sombreadas y expuestas. Es "corrible" (runnable), fluido y no técnico, favoreciendo la progresión durante muchas horas. Cuenta con 150 banderas cada 40 metros con material reflectante.',
  },
  {
    question: '¿Hay comida disponible?',
    answer:
      'Hay snacks y frutas disponibles en la línea de meta para los atletas, también habrá un Foodtruck para comprar según disponibilidad del menú. Se recomienda llevar tus propios alimentos de fácil consumo para la carrera.',
  },
  {
    question: '¿Qué actividades hay para acompañantes?',
    answer:
      'El hotel ofrece piscina, áreas verdes y diversas actividades recreativas con costo adicional: Four Wheel, Go Karts, Kayak, Zipline, tours de apiario y cabalgatas. Requiere compra del daypass.',
  },
];
