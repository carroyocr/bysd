import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  Upload, Calendar, Building2, Hash, CheckCircle, AlertCircle, 
  Loader2, CreditCard, FileText, ArrowLeft, ImageIcon, Wallet, CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PaymentReceiptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    payment_date: '',
    bank_origin: '',
    transfer_number: '',
    monto_pagado: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Token no válido. Por favor usa el enlace que recibiste por correo.');
      setLoading(false);
      return;
    }
    
    loadPaymentInfo();
  }, [token]);

  const loadPaymentInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/registration/payment-info/${token}`);
      
      if (!response.ok) {
        throw new Error('No se pudo cargar la información');
      }
      
      const result = await response.json();
      setData(result);
      
      // Check if already submitted
      if (result.registration?.payment_receipt?.status) {
        setSuccess(true);
      }
    } catch (err) {
      setError('No se encontró tu registro o el enlace ha expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato no válido. Use JPG, PNG, WebP o PDF.');
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máximo 10MB)');
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Lo que tiene que cubrir el comprobante: el costo, o lo que faltaba si ya
  // hay un plazo aprobado. Por debajo de eso es un abono y va por el plazo:
  // si se sube como pago completo, lo que falta desaparece de los papeles.
  const montoEsperado = Number(data?.monto_esperado ?? data?.race_config?.registration_cost ?? 0);
  const montoDeclarado = Number(formData.monto_pagado) || 0;
  const esAbono = montoEsperado > 0 && montoDeclarado > 0 && montoDeclarado < montoEsperado;
  const plazoAprobado = data?.registration?.plazo_pago?.estado === 'aprobado'
    ? data.registration.plazo_pago : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Por favor selecciona una imagen del comprobante');
      return;
    }
    
    if (!formData.payment_date) {
      toast.error('Por favor indica la fecha del pago');
      return;
    }
    
    if (!formData.bank_origin) {
      toast.error('Por favor indica el banco desde donde realizaste el pago');
      return;
    }

    if (!(Number(formData.monto_pagado) > 0)) {
      toast.error('Indica cuánto pagaste');
      return;
    }
    if (esAbono) {
      toast.error('Eso es un abono: pide más tiempo para pagar y súbelo por ahí');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const submitData = new FormData();
      submitData.append('receipt_image', selectedFile);
      submitData.append('payment_date', formData.payment_date);
      submitData.append('bank_origin', formData.bank_origin);
      submitData.append('monto_pagado', formData.monto_pagado);
      if (formData.transfer_number) {
        submitData.append('transfer_number', formData.transfer_number);
      }
      
      const response = await fetch(`${API_URL}/api/registration/submit-payment-receipt/${token}`, {
        method: 'POST',
        body: submitData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al enviar el comprobante');
      }
      
      toast.success('¡Comprobante enviado exitosamente!');
      setSuccess(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100">
        <Navigation />
        <div className="flex items-center justify-center pt-24 py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-100">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 pt-24 py-12">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-600">{error}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    const receiptStatus = data?.registration?.payment_receipt?.status;
    
    return (
      <div className="min-h-screen bg-stone-100">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 pt-24 py-12">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-semibold text-green-800 mb-2">
                {receiptStatus === 'approved' ? '¡Pago Confirmado!' : '¡Comprobante Recibido!'}
              </h2>
              <p className="text-green-600 mb-4">
                {receiptStatus === 'approved' 
                  ? 'Tu pago ha sido verificado y confirmado. ¡Ya eres un participante oficial!'
                  : 'Hemos recibido tu comprobante de pago. Te notificaremos una vez que sea revisado.'}
              </p>
              <Badge 
                className={receiptStatus === 'approved' 
                  ? 'bg-green-500' 
                  : receiptStatus === 'rejected'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }
              >
                {receiptStatus === 'approved' 
                  ? 'Aprobado' 
                  : receiptStatus === 'rejected'
                    ? 'Rechazado'
                    : 'En Revisión'}
              </Badge>
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { registration, race_config } = data || {};

  // Ya no queda cupo que pagar: mejor decirlo aquí que dejarle llenar el
  // formulario para rechazárselo al enviar.
  if (data?.impedimento) {
    return (
      <div className="min-h-screen bg-stone-100">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 pt-24 py-12">
          <Card data-testid="sin-cupo-para-pagar">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Por ahora no quedan cupos</h2>
              <p className="text-gray-600">{data.impedimento}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 pt-24 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subir Comprobante de Pago
          </h1>
          <p className="text-gray-600">
            Hola <span className="font-semibold">{registration?.nombre} {registration?.apellidos}</span>
          </p>
        </div>

        {/* Payment Info Card */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-green-800">
              <CreditCard className="w-5 h-5" />
              Datos de la Cuenta para el Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-600">{plazoAprobado ? 'Te falta pagar:' : 'Monto:'}</span>
                <p className="font-bold text-green-800 text-lg">
                  RD$ {montoEsperado > 0 ? montoEsperado.toLocaleString('es-DO') : (race_config?.registration_cost?.toLocaleString('es-DO') || '-')}
                </p>
                {plazoAprobado && (
                  <p className="text-xs text-green-700">
                    Ya abonaste RD$ {Number(plazoAprobado.monto_abonado || 0).toLocaleString('es-DO')}
                  </p>
                )}
              </div>
              <div>
                <span className="text-green-600">Banco:</span>
                <p className="font-semibold text-green-800">{race_config?.payment_bank_name || 'No configurado'}</p>
              </div>
              <div>
                <span className="text-green-600">Tipo de Cuenta:</span>
                <p className="font-medium text-green-800">{race_config?.payment_account_type || '-'}</p>
              </div>
              <div>
                <span className="text-green-600">Número de Cuenta:</span>
                <p className="font-mono font-medium text-green-800">{race_config?.payment_account_number || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-green-600">A nombre de:</span>
                <p className="font-semibold text-green-800">{race_config?.payment_account_name || '-'}</p>
              </div>
              {race_config?.payment_account_id && (
                <div className="col-span-2">
                  <span className="text-green-600">Cédula/Pasaporte:</span>
                  <p className="font-mono font-medium text-green-800">{race_config.payment_account_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment timeline note */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800" data-testid="payment-timeline-note">
          <p className="font-semibold mb-1">Importante sobre el pago:</p>
          <p>El pago de la inscripción no es requerido en este momento. Se solicitará <strong>4 meses antes de la carrera</strong>. Recibirás un correo electrónico con el recordatorio y tendrás <strong>30 días</strong> para completarlo.</p>
        </div>

        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Información del Pago
            </CardTitle>
            <CardDescription>
              Completa los datos y sube una imagen del comprobante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="payment_date" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Fecha del Pago *
                </Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                  required
                  data-testid="payment-date-input"
                />
              </div>

              {/* Monto pagado */}
              <div className="space-y-2">
                <Label htmlFor="monto_pagado" className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-gray-500" />
                  ¿Cuánto pagaste? (RD$) *
                </Label>
                <Input
                  id="monto_pagado"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder={montoEsperado > 0 ? String(montoEsperado) : ''}
                  value={formData.monto_pagado}
                  onChange={(e) => setFormData(prev => ({ ...prev, monto_pagado: e.target.value }))}
                  required
                  data-testid="monto-pagado-input"
                />
                {esAbono && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-2" data-testid="abono-aviso">
                    <p>
                      Eso no cubre lo que falta (RD$ {montoEsperado.toLocaleString('es-DO')}), así que
                      es un <strong>abono</strong>. Los abonos van por «más tiempo para pagar»: ahí se
                      anota lo que abonaste y cuándo saldas el resto, y tu cupo queda reservado.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={() => navigate(`/plazo-de-pago?token=${token}`)}
                      data-testid="ir-a-plazo-btn"
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Pedir más tiempo para pagar
                    </Button>
                  </div>
                )}
              </div>

              {/* Bank Origin */}
              <div className="space-y-2">
                <Label htmlFor="bank_origin" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  Banco de Origen *
                </Label>
                <Input
                  id="bank_origin"
                  type="text"
                  placeholder="Ej: Banco Popular, Banreservas, BHD León..."
                  value={formData.bank_origin}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_origin: e.target.value }))}
                  required
                  data-testid="bank-origin-input"
                />
              </div>

              {/* Transfer Number */}
              <div className="space-y-2">
                <Label htmlFor="transfer_number" className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-500" />
                  Número de Transferencia (Opcional)
                </Label>
                <Input
                  id="transfer_number"
                  type="text"
                  placeholder="Número de referencia o confirmación"
                  value={formData.transfer_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, transfer_number: e.target.value }))}
                  data-testid="transfer-number-input"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  Imagen del Comprobante *
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="receipt-upload"
                    data-testid="receipt-upload-input"
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    {previewUrl ? (
                      <div className="space-y-2">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-h-48 mx-auto rounded-lg shadow-md"
                        />
                        <p className="text-sm text-gray-500">{selectedFile?.name}</p>
                        <Button type="button" variant="outline" size="sm">
                          Cambiar imagen
                        </Button>
                      </div>
                    ) : selectedFile ? (
                      <div className="space-y-2">
                        <FileText className="w-12 h-12 mx-auto text-orange-500" />
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <Button type="button" variant="outline" size="sm">
                          Cambiar archivo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 mx-auto text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Haz clic para seleccionar una imagen
                        </p>
                        <p className="text-xs text-gray-400">
                          JPG, PNG, WebP o PDF (máx. 10MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={submitting || !selectedFile || esAbono}
                data-testid="submit-receipt-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Comprobante
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
