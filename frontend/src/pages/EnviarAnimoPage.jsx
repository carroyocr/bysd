import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, Send, ArrowLeft, Check } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

export default function EnviarAnimoPage() {
  const { bib } = useParams();
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fanName, setFanName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [fanBadge, setFanBadge] = useState(null);

  useEffect(() => {
    loadAthlete();
  }, [bib]);

  const loadAthlete = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`);
      if (response.ok) {
        const data = await response.json();
        const found = data.find(a => a.bib === bib);
        setAthlete(found || null);
      }
    } catch (error) {
      console.error('Error loading athlete:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFanBadge = async (name) => {
    if (!name.trim()) {
      setFanBadge(null);
      return;
    }
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/fans/badge/${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.cheer_count > 0) {
          setFanBadge(data);
        } else {
          setFanBadge(null);
        }
      }
    } catch (error) {
      console.error('Error loading fan badge:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!fanName.trim() || !message.trim()) {
      setResult({ type: 'error', text: 'Por favor completa todos los campos' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_bib: bib,
          fan_name: fanName,
          message: message
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ type: 'success', text: '¡Mensaje enviado exitosamente!' });
        setMessage('');
      } else {
        setResult({ type: 'error', text: data.detail || 'Error al enviar mensaje' });
      }
    } catch (error) {
      setResult({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-purple-400 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Atleta no encontrado</h2>
              <p className="text-muted-foreground mb-6">No pudimos encontrar al atleta con número #{bib}</p>
              <Link to="/comunidad">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ir a Comunidad
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-10">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2">
            Mensaje de Ánimo
          </h1>
          <p className="text-center text-purple-100">
            Backyard Ultra Santo Domingo 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Athlete Card */}
          <Card className="mb-6 border-2 border-purple-200 shadow-lg">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                  #{athlete.bib}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1">
                  {athlete.nombre} {athlete.apellidos}
                </h2>
                <Badge variant="secondary" className="text-sm mb-3">
                  {athlete.nacionalidad}
                </Badge>
                <div className="flex justify-center gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{athlete.laps_completed}</p>
                    <p className="text-xs text-muted-foreground">Vueltas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{athlete.total_km} km</p>
                    <p className="text-xs text-muted-foreground">Recorridos</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success State */}
          {result?.type === 'success' ? (
            <Card className="shadow-lg border-green-200 bg-green-50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">¡Mensaje Enviado!</h3>
                <p className="text-green-700 mb-6">Tu mensaje de ánimo ha sido enviado a {athlete.nombre}.</p>
                
                <div className="space-y-3">
                  <Button
                    onClick={() => setResult(null)}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar otro mensaje
                  </Button>
                  <Link to="/comunidad" className="block">
                    <Button variant="outline" className="w-full">
                      Ver todos los mensajes
                    </Button>
                  </Link>
                  <Link to="/en-vivo" className="block">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Volver a Seguimiento
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Message Form */
            <Card className="shadow-lg">
              <CardContent className="p-6">
                {/* Fan Name */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Tu nombre</label>
                  <Input
                    type="text"
                    placeholder="Tu nombre"
                    value={fanName}
                    onChange={(e) => {
                      setFanName(e.target.value);
                      clearTimeout(window.badgeTimeout);
                      window.badgeTimeout = setTimeout(() => loadFanBadge(e.target.value), 500);
                    }}
                    maxLength={50}
                  />
                  {fanBadge && (
                    <div className="mt-2 p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{fanBadge.badge.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            ¡Hola {fanBadge.badge.name}! ({fanBadge.cheer_count} mensajes)
                          </p>
                          {fanBadge.next_badge && (
                            <p className="text-xs text-green-600">
                              {fanBadge.next_badge.required - fanBadge.cheer_count} más para {fanBadge.next_badge.emoji} {fanBadge.next_badge.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Tu mensaje</label>
                  <textarea
                    placeholder="¡Escribe tu mensaje de ánimo para el atleta!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={280}
                    rows={4}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">{message.length}/280</p>
                </div>

                {/* Error */}
                {result?.type === 'error' && (
                  <div className="p-3 rounded-lg mb-4 bg-red-100 text-red-800">
                    {result.text}
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !fanName.trim() || !message.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 mb-4"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Enviando...' : 'Enviar Mensaje'}
                </Button>

                {/* Back Links */}
                <div className="flex gap-2">
                  <Link to="/en-vivo" className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Seguimiento
                    </Button>
                  </Link>
                  <Link to="/comunidad" className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Comunidad
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
