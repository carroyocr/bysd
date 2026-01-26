import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Users, Heart, Eye, Star, Send, CheckCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Rating component for 1-5 scale
const RatingInput = ({ name, value, onChange, label }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <RadioGroup 
      value={value?.toString()} 
      onValueChange={(val) => onChange(name, parseInt(val))}
      className="flex gap-2"
    >
      {[1, 2, 3, 4, 5].map((num) => (
        <div key={num} className="flex flex-col items-center">
          <RadioGroupItem
            value={num.toString()}
            id={`${name}-${num}`}
            className="peer sr-only"
          />
          <Label
            htmlFor={`${name}-${num}`}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-2 transition-all ${
              value === num
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted hover:bg-muted/80 border-border'
            }`}
          >
            {num}
          </Label>
          {num === 1 && <span className="text-xs text-muted-foreground mt-1">Malo</span>}
          {num === 5 && <span className="text-xs text-muted-foreground mt-1">Excelente</span>}
        </div>
      ))}
    </RadioGroup>
  </div>
);

// Yes/No/Maybe selector
const YesNoMaybeInput = ({ name, value, onChange, label }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <RadioGroup 
      value={value} 
      onValueChange={(val) => onChange(name, val)}
      className="flex gap-4"
    >
      {['Sí', 'No', 'Tal vez'].map((option) => (
        <div key={option} className="flex items-center space-x-2">
          <RadioGroupItem value={option} id={`${name}-${option}`} />
          <Label htmlFor={`${name}-${option}`} className="cursor-pointer">{option}</Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

// Athletes Survey Form
const AthletesSurveyForm = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    bib: '',
    satisfaccion_general: null,
    organizacion_evento: null,
    comunicacion_previa: null,
    proceso_registro: null,
    kit_corredor: null,
    marcacion_ruta: null,
    seguridad_ruta: null,
    estaciones_hidratacion: null,
    atencion_medica: null,
    instalaciones: null,
    ambiente_comunidad: null,
    lo_mejor: '',
    areas_mejora: '',
    participaria_nuevamente: '',
    recomendaria: '',
    comentarios_adicionales: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const requiredRatings = ['satisfaccion_general', 'organizacion_evento', 'comunicacion_previa', 
      'proceso_registro', 'kit_corredor', 'marcacion_ruta', 'seguridad_ruta', 
      'estaciones_hidratacion', 'atencion_medica', 'instalaciones', 'ambiente_comunidad'];
    
    for (const field of requiredRatings) {
      if (!formData[field]) {
        toast.error('Por favor completa todas las preguntas de calificación');
        return;
      }
    }
    
    if (!formData.nombre || !formData.email || !formData.participaria_nuevamente || !formData.recomendaria) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/surveys/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setSubmitted(true);
        toast.success('¡Gracias por completar la encuesta!');
      } else {
        throw new Error('Error al enviar');
      }
    } catch (error) {
      toast.error('Error al enviar la encuesta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">¡Gracias!</h3>
        <p className="text-muted-foreground">Tu opinión es muy valiosa para nosotros.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre completo *</Label>
          <Input 
            id="nombre" 
            value={formData.nombre} 
            onChange={(e) => handleChange('nombre', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input 
            id="email" 
            type="email"
            value={formData.email} 
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bib">Número de dorsal</Label>
          <Input 
            id="bib" 
            value={formData.bib} 
            onChange={(e) => handleChange('bib', e.target.value)}
            placeholder="Ej: 001"
          />
        </div>
      </div>

      {/* Ratings Section */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Califica del 1 al 5 (1=Malo, 5=Excelente)</h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <RatingInput 
            name="satisfaccion_general" 
            value={formData.satisfaccion_general} 
            onChange={handleChange}
            label="Satisfacción general con el evento"
          />
          <RatingInput 
            name="organizacion_evento" 
            value={formData.organizacion_evento} 
            onChange={handleChange}
            label="Organización del evento"
          />
          <RatingInput 
            name="comunicacion_previa" 
            value={formData.comunicacion_previa} 
            onChange={handleChange}
            label="Comunicación previa al evento"
          />
          <RatingInput 
            name="proceso_registro" 
            value={formData.proceso_registro} 
            onChange={handleChange}
            label="Proceso de registro"
          />
          <RatingInput 
            name="kit_corredor" 
            value={formData.kit_corredor} 
            onChange={handleChange}
            label="Kit del corredor"
          />
          <RatingInput 
            name="marcacion_ruta" 
            value={formData.marcacion_ruta} 
            onChange={handleChange}
            label="Marcación de la ruta"
          />
          <RatingInput 
            name="seguridad_ruta" 
            value={formData.seguridad_ruta} 
            onChange={handleChange}
            label="Seguridad en la ruta"
          />
          <RatingInput 
            name="estaciones_hidratacion" 
            value={formData.estaciones_hidratacion} 
            onChange={handleChange}
            label="Estaciones de hidratación"
          />
          <RatingInput 
            name="atencion_medica" 
            value={formData.atencion_medica} 
            onChange={handleChange}
            label="Atención médica"
          />
          <RatingInput 
            name="instalaciones" 
            value={formData.instalaciones} 
            onChange={handleChange}
            label="Instalaciones (baños, zona de descanso)"
          />
          <RatingInput 
            name="ambiente_comunidad" 
            value={formData.ambiente_comunidad} 
            onChange={handleChange}
            label="Ambiente y comunidad"
          />
        </div>
      </div>

      {/* Text Questions */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Cuéntanos más</h4>
        
        <div className="space-y-2">
          <Label htmlFor="lo_mejor">¿Qué fue lo mejor del evento?</Label>
          <Textarea 
            id="lo_mejor"
            value={formData.lo_mejor}
            onChange={(e) => handleChange('lo_mejor', e.target.value)}
            placeholder="Comparte tu experiencia..."
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="areas_mejora">¿Qué áreas crees que podemos mejorar?</Label>
          <Textarea 
            id="areas_mejora"
            value={formData.areas_mejora}
            onChange={(e) => handleChange('areas_mejora', e.target.value)}
            placeholder="Tus sugerencias nos ayudan a crecer..."
          />
        </div>

        <YesNoMaybeInput 
          name="participaria_nuevamente"
          value={formData.participaria_nuevamente}
          onChange={handleChange}
          label="¿Participarías nuevamente en este evento? *"
        />

        <YesNoMaybeInput 
          name="recomendaria"
          value={formData.recomendaria}
          onChange={handleChange}
          label="¿Recomendarías este evento a otros corredores? *"
        />

        <div className="space-y-2">
          <Label htmlFor="comentarios_adicionales">Comentarios adicionales</Label>
          <Textarea 
            id="comentarios_adicionales"
            value={formData.comentarios_adicionales}
            onChange={(e) => handleChange('comentarios_adicionales', e.target.value)}
            placeholder="Cualquier otro comentario que quieras compartir..."
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Enviar Encuesta'}
        <Send className="w-4 h-4 ml-2" />
      </Button>
    </form>
  );
};

// Volunteers Survey Form
const VolunteersSurveyForm = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    area_voluntariado: '',
    satisfaccion_general: null,
    claridad_funciones: null,
    capacitacion_recibida: null,
    comunicacion_coordinadores: null,
    materiales_recursos: null,
    trato_organizacion: null,
    alimentacion_hidratacion: null,
    horarios_turnos: null,
    ambiente_equipo: null,
    reconocimiento: null,
    lo_mejor: '',
    areas_mejora: '',
    voluntario_nuevamente: '',
    recomendaria: '',
    comentarios_adicionales: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const requiredRatings = ['satisfaccion_general', 'claridad_funciones', 'capacitacion_recibida',
      'comunicacion_coordinadores', 'materiales_recursos', 'trato_organizacion',
      'alimentacion_hidratacion', 'horarios_turnos', 'ambiente_equipo', 'reconocimiento'];
    
    for (const field of requiredRatings) {
      if (!formData[field]) {
        toast.error('Por favor completa todas las preguntas de calificación');
        return;
      }
    }
    
    if (!formData.nombre || !formData.email || !formData.voluntario_nuevamente || !formData.recomendaria) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/surveys/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setSubmitted(true);
        toast.success('¡Gracias por completar la encuesta!');
      } else {
        throw new Error('Error al enviar');
      }
    } catch (error) {
      toast.error('Error al enviar la encuesta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">¡Gracias!</h3>
        <p className="text-muted-foreground">Tu dedicación hace posible este evento.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vol-nombre">Nombre completo *</Label>
          <Input 
            id="vol-nombre" 
            value={formData.nombre} 
            onChange={(e) => handleChange('nombre', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vol-email">Email *</Label>
          <Input 
            id="vol-email" 
            type="email"
            value={formData.email} 
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="area">Área de voluntariado</Label>
          <Select onValueChange={(val) => handleChange('area_voluntariado', val)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hidratacion">Hidratación</SelectItem>
              <SelectItem value="registro">Registro</SelectItem>
              <SelectItem value="ruta">Control de ruta</SelectItem>
              <SelectItem value="logistica">Logística</SelectItem>
              <SelectItem value="medico">Apoyo médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ratings Section */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Califica del 1 al 5 (1=Malo, 5=Excelente)</h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <RatingInput 
            name="satisfaccion_general" 
            value={formData.satisfaccion_general} 
            onChange={handleChange}
            label="Satisfacción general"
          />
          <RatingInput 
            name="claridad_funciones" 
            value={formData.claridad_funciones} 
            onChange={handleChange}
            label="Claridad en las funciones asignadas"
          />
          <RatingInput 
            name="capacitacion_recibida" 
            value={formData.capacitacion_recibida} 
            onChange={handleChange}
            label="Capacitación recibida"
          />
          <RatingInput 
            name="comunicacion_coordinadores" 
            value={formData.comunicacion_coordinadores} 
            onChange={handleChange}
            label="Comunicación con coordinadores"
          />
          <RatingInput 
            name="materiales_recursos" 
            value={formData.materiales_recursos} 
            onChange={handleChange}
            label="Materiales y recursos disponibles"
          />
          <RatingInput 
            name="trato_organizacion" 
            value={formData.trato_organizacion} 
            onChange={handleChange}
            label="Trato de la organización"
          />
          <RatingInput 
            name="alimentacion_hidratacion" 
            value={formData.alimentacion_hidratacion} 
            onChange={handleChange}
            label="Alimentación e hidratación para voluntarios"
          />
          <RatingInput 
            name="horarios_turnos" 
            value={formData.horarios_turnos} 
            onChange={handleChange}
            label="Horarios y turnos"
          />
          <RatingInput 
            name="ambiente_equipo" 
            value={formData.ambiente_equipo} 
            onChange={handleChange}
            label="Ambiente de equipo"
          />
          <RatingInput 
            name="reconocimiento" 
            value={formData.reconocimiento} 
            onChange={handleChange}
            label="Reconocimiento recibido"
          />
        </div>
      </div>

      {/* Text Questions */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Cuéntanos más</h4>
        
        <div className="space-y-2">
          <Label htmlFor="vol-lo_mejor">¿Qué fue lo mejor de ser voluntario?</Label>
          <Textarea 
            id="vol-lo_mejor"
            value={formData.lo_mejor}
            onChange={(e) => handleChange('lo_mejor', e.target.value)}
            placeholder="Comparte tu experiencia..."
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="vol-areas_mejora">¿Qué áreas crees que podemos mejorar?</Label>
          <Textarea 
            id="vol-areas_mejora"
            value={formData.areas_mejora}
            onChange={(e) => handleChange('areas_mejora', e.target.value)}
            placeholder="Tus sugerencias nos ayudan a crecer..."
          />
        </div>

        <YesNoMaybeInput 
          name="voluntario_nuevamente"
          value={formData.voluntario_nuevamente}
          onChange={handleChange}
          label="¿Serías voluntario nuevamente? *"
        />

        <YesNoMaybeInput 
          name="recomendaria"
          value={formData.recomendaria}
          onChange={handleChange}
          label="¿Recomendarías ser voluntario en este evento? *"
        />

        <div className="space-y-2">
          <Label htmlFor="vol-comentarios">Comentarios adicionales</Label>
          <Textarea 
            id="vol-comentarios"
            value={formData.comentarios_adicionales}
            onChange={(e) => handleChange('comentarios_adicionales', e.target.value)}
            placeholder="Cualquier otro comentario..."
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Enviar Encuesta'}
        <Send className="w-4 h-4 ml-2" />
      </Button>
    </form>
  );
};

// Spectators Survey Form
const SpectatorsSurveyForm = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    relacion_evento: '',
    satisfaccion_general: null,
    facilidad_acceso: null,
    informacion_evento: null,
    visibilidad_recorrido: null,
    servicios_disponibles: null,
    ambiente_general: null,
    atencion_personal: null,
    lo_mejor: '',
    areas_mejora: '',
    asistiria_nuevamente: '',
    recomendaria: '',
    comentarios_adicionales: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const requiredRatings = ['satisfaccion_general', 'facilidad_acceso', 'informacion_evento',
      'visibilidad_recorrido', 'servicios_disponibles', 'ambiente_general', 'atencion_personal'];
    
    for (const field of requiredRatings) {
      if (!formData[field]) {
        toast.error('Por favor completa todas las preguntas de calificación');
        return;
      }
    }
    
    if (!formData.nombre || !formData.email || !formData.asistiria_nuevamente || !formData.recomendaria) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/surveys/spectators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setSubmitted(true);
        toast.success('¡Gracias por completar la encuesta!');
      } else {
        throw new Error('Error al enviar');
      }
    } catch (error) {
      toast.error('Error al enviar la encuesta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">¡Gracias!</h3>
        <p className="text-muted-foreground">Tu apoyo significa mucho para los atletas.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="spec-nombre">Nombre completo *</Label>
          <Input 
            id="spec-nombre" 
            value={formData.nombre} 
            onChange={(e) => handleChange('nombre', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spec-email">Email *</Label>
          <Input 
            id="spec-email" 
            type="email"
            value={formData.email} 
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="relacion">Relación con el evento</Label>
          <Select onValueChange={(val) => handleChange('relacion_evento', val)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="familiar">Familiar de corredor</SelectItem>
              <SelectItem value="amigo">Amigo de corredor</SelectItem>
              <SelectItem value="aficionado">Aficionado al running</SelectItem>
              <SelectItem value="curioso">Visitante curioso</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ratings Section */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Califica del 1 al 5 (1=Malo, 5=Excelente)</h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <RatingInput 
            name="satisfaccion_general" 
            value={formData.satisfaccion_general} 
            onChange={handleChange}
            label="Satisfacción general"
          />
          <RatingInput 
            name="facilidad_acceso" 
            value={formData.facilidad_acceso} 
            onChange={handleChange}
            label="Facilidad de acceso al evento"
          />
          <RatingInput 
            name="informacion_evento" 
            value={formData.informacion_evento} 
            onChange={handleChange}
            label="Información disponible del evento"
          />
          <RatingInput 
            name="visibilidad_recorrido" 
            value={formData.visibilidad_recorrido} 
            onChange={handleChange}
            label="Visibilidad del recorrido"
          />
          <RatingInput 
            name="servicios_disponibles" 
            value={formData.servicios_disponibles} 
            onChange={handleChange}
            label="Servicios disponibles (comida, baños)"
          />
          <RatingInput 
            name="ambiente_general" 
            value={formData.ambiente_general} 
            onChange={handleChange}
            label="Ambiente general"
          />
          <RatingInput 
            name="atencion_personal" 
            value={formData.atencion_personal} 
            onChange={handleChange}
            label="Atención del personal"
          />
        </div>
      </div>

      {/* Text Questions */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg border-b pb-2">Cuéntanos más</h4>
        
        <div className="space-y-2">
          <Label htmlFor="spec-lo_mejor">¿Qué fue lo mejor del evento?</Label>
          <Textarea 
            id="spec-lo_mejor"
            value={formData.lo_mejor}
            onChange={(e) => handleChange('lo_mejor', e.target.value)}
            placeholder="Comparte tu experiencia..."
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="spec-areas_mejora">¿Qué áreas crees que podemos mejorar?</Label>
          <Textarea 
            id="spec-areas_mejora"
            value={formData.areas_mejora}
            onChange={(e) => handleChange('areas_mejora', e.target.value)}
            placeholder="Tus sugerencias nos ayudan a crecer..."
          />
        </div>

        <YesNoMaybeInput 
          name="asistiria_nuevamente"
          value={formData.asistiria_nuevamente}
          onChange={handleChange}
          label="¿Asistirías nuevamente como espectador? *"
        />

        <YesNoMaybeInput 
          name="recomendaria"
          value={formData.recomendaria}
          onChange={handleChange}
          label="¿Recomendarías asistir a este evento? *"
        />

        <div className="space-y-2">
          <Label htmlFor="spec-comentarios">Comentarios adicionales</Label>
          <Textarea 
            id="spec-comentarios"
            value={formData.comentarios_adicionales}
            onChange={(e) => handleChange('comentarios_adicionales', e.target.value)}
            placeholder="Cualquier otro comentario..."
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Enviar Encuesta'}
        <Send className="w-4 h-4 ml-2" />
      </Button>
    </form>
  );
};

export default function SurveyPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Encuesta de Satisfacción
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tu opinión es muy importante para nosotros. Ayúdanos a mejorar completando esta breve encuesta.
          </p>
        </div>

        {/* Survey Tabs */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Selecciona tu tipo de participación
            </CardTitle>
            <CardDescription>
              Elige la encuesta que corresponde a tu rol en el evento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="athletes" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="athletes" className="flex items-center gap-2" data-testid="tab-athletes">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Atletas</span>
                </TabsTrigger>
                <TabsTrigger value="volunteers" className="flex items-center gap-2" data-testid="tab-volunteers">
                  <Heart className="w-4 h-4" />
                  <span className="hidden sm:inline">Voluntarios</span>
                </TabsTrigger>
                <TabsTrigger value="spectators" className="flex items-center gap-2" data-testid="tab-spectators">
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Espectadores</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="athletes" data-testid="survey-athletes-form">
                <AthletesSurveyForm />
              </TabsContent>
              
              <TabsContent value="volunteers" data-testid="survey-volunteers-form">
                <VolunteersSurveyForm />
              </TabsContent>
              
              <TabsContent value="spectators" data-testid="survey-spectators-form">
                <SpectatorsSurveyForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
