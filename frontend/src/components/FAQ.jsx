import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';

export default function FAQ() {
  const faqs = [
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
        'Puedes descansar, hidratarte y comer en el área designada de meta/salida entre vueltas. Cada atleta tiene un espacio asignado de 4m x 4m para carpas personales, o puedes usar el área cubierta compartida (Rancho) de 600 m².',
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
        'Hay snacks y frutas disponibles en la línea de meta. El hotel ofrece almuerzo buffet por RD$550.00 por persona. Se recomienda llevar tus propios alimentos de fácil consumo para la carrera.',
    },
    {
      question: '¿Qué actividades hay para acompañantes?',
      answer:
        'El hotel ofrece piscina, áreas verdes y diversas actividades recreativas con costo adicional: Four Wheel, Go Karts, Kayak, Zipline, tours de apiario y cabalgatas.',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              FAQ
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Respuestas a las preguntas más comunes sobre el evento
            </p>
          </div>

          {/* FAQ Accordion */}
          <Card className="border-border shadow-medium">
            <CardContent className="p-6 md:p-8">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-border">
                    <AccordionTrigger className="text-left hover:text-primary transition-colors">
                      <span className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{faq.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pl-8 pr-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <HelpCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">
                ¿Tienes más preguntas?
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Si no encontraste la respuesta que buscabas, no dudes en contactarnos.
                Estamos aquí para ayudarte.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}