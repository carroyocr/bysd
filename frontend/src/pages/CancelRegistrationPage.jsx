import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  XCircle, CheckCircle, Loader2, ArrowLeft, AlertTriangle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cancellation reasons
const CANCELLATION_REASONS = [
  "Me lesioné",
  "Ya no estoy interesado en participar",
  "Tengo otros compromisos",
  "Otra razón"
];

export default function CancelRegistrationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const type = searchParams.get('type') || 'athlete'; // 'athlete' or 'volunteer'
  
  const [loading, setLoading] = useState(true);
  const [registrationData, setRegistrationData] = useState(null);
  const [error, setError] = useState(null);
  
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  
  // Load registration data on mount
  useEffect(() => {
    if (token) {
      loadRegistrationData();
    } else {
      setError('No se proporcionó un token válido');
      setLoading(false);
    }
  }, [token]);
  
  const loadRegistrationData = async () => {
    try {
      // Try to load athlete registration first
      let response = await fetch(`${API_URL}/api/registration/my-registration?token=${token}`);
      
      if (response.ok) {
        const data = await response.json();
        setRegistrationData({ ...data, type: 'athlete' });
      } else {
        // Try volunteer registration
        response = await fetch(`${API_URL}/api/volunteer-registration/by-token/${token}`);
        if (response.ok) {
          const data = await response.json();
          setRegistrationData({ ...data, type: 'volunteer' });
        } else {
          setError('No se encontró un registro con este token. El enlace puede haber expirado o ser inválido.');
        }
      }
    } catch (err) {
      console.error('Error loading registration:', err);
      setError('Error al cargar los datos del registro');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancellation = async () => {
    if (!selectedReason) {
      toast.error('Por favor selecciona una razón de cancelación');
      return;
    }
    
    if (selectedReason === 'Otra razón' && !otherReason.trim()) {
      toast.error('Por favor especifica la razón de cancelación');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const endpoint = registrationData.type === 'athlete'
        ? `${API_URL}/api/registration/cancel/${token}`
        : `${API_URL}/api/volunteer-registration/cancel/${token}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          other_reason: selectedReason === 'Otra razón' ? otherReason : null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCancelled(true);
        toast.success('Registro cancelado exitosamente');
      } else {
        toast.error(data.detail || 'Error al cancelar el registro');
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Link to="/">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Inicio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Cancellation complete state
  if (cancelled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Registro Cancelado</h2>
              <p className="text-muted-foreground mb-4">
                Tu {registrationData?.type === 'volunteer' ? 'postulación como voluntario' : 'inscripción'} ha sido cancelada correctamente.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Recibirás un correo de confirmación en breve.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-blue-800">
                  Si cambiaste de opinión, puedes volver a registrarte en cualquier momento.
                </p>
              </div>
              <Link to="/">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Inicio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Main cancellation form
  const nombre = `${registrationData?.nombre || ''} ${registrationData?.apellidos || ''}`.trim();
  const isVolunteer = registrationData?.type === 'volunteer';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Cancelar {isVolunteer ? 'Postulación' : 'Inscripción'}</h1>
          <p className="text-gray-200 mt-2">Backyard Ultra Santo Domingo</p>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <XCircle className="w-5 h-5" />
              Confirmar Cancelación
            </CardTitle>
            <CardDescription>
              {isVolunteer 
                ? 'Estás a punto de cancelar tu postulación como voluntario' 
                : 'Estás a punto de cancelar tu inscripción como atleta'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Registration Info */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="font-medium text-gray-900 mb-2">Información del Registro</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Nombre:</strong> {nombre}</p>
                <p><strong>Email:</strong> {registrationData?.email}</p>
                {registrationData?.race_code && (
                  <p><strong>Carrera:</strong> {registrationData.race_code}</p>
                )}
                <p><strong>Tipo:</strong> {isVolunteer ? 'Voluntario' : 'Atleta'}</p>
              </div>
            </div>
            
            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Atención</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Esta acción no se puede deshacer. Tu {isVolunteer ? 'postulación' : 'inscripción'} será 
                    <strong> eliminada permanentemente</strong> del sistema. Si deseas participar en el futuro, 
                    tendrás que volver a registrarte desde cero.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Reason Selection */}
            <div className="space-y-3">
              <Label className="text-base">¿Por qué deseas cancelar? *</Label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => (
                  <label 
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedReason === reason 
                        ? 'border-primary bg-primary/5' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>
              
              {/* Other reason input */}
              {selectedReason === 'Otra razón' && (
                <div className="mt-3">
                  <Label htmlFor="other-reason">Especifica la razón *</Label>
                  <textarea
                    id="other-reason"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Escribe aquí tu razón..."
                    className="w-full mt-2 min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                    maxLength={500}
                  />
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  No, Volver
                </Button>
              </Link>
              <Button 
                onClick={handleCancellation}
                disabled={submitting || !selectedReason}
                variant="destructive"
                className="flex-1"
                data-testid="confirm-cancel-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Confirmar Cancelación
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
