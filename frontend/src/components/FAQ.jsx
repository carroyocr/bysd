import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { FAQS } from '../content/eventInfo';

export default function FAQ() {
  const faqs = FAQS;

  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
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