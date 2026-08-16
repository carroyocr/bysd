import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserCircle2, MailCheck, MailX, Loader2, LogOut, Trash2, Heart, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import CuentaAcceso from '../components/CuentaAcceso';
import {
  cuentaFetch, hayCuenta, cerrarSesionCuenta, verificar, reenviarCodigo,
} from '../lib/cuentaApi';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * El perfil de quien sigue la carrera.
 *
 * Existe sobre todo por dos promesas de la política de privacidad que tienen
 * que ser ciertas y accionables sin escribirle a nadie: retirar el
 * consentimiento de comunicaciones, y borrar la cuenta. Un texto legal que diga
 * "puedes hacerlo desde tu perfil" sin que haya un botón no vale nada.
 *
 * Del atleta y del staff no se ocupa: esos siguen en Mi Perfil y en el panel
 * hasta la fase 3 del plan.
 */
export default function MiCuentaPage() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    if (!hayCuenta()) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const r = await cuentaFetch(`${API}/api/cuentas/perfil`);
      if (r.status === 401 || r.status === 403) {
        cerrarSesionCuenta();
        setPerfil(null);
      } else if (r.ok) {
        setPerfil(await r.json());
      } else {
        setError('No se pudo cargar tu cuenta.');
      }
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (cambios) => {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const r = await cuentaFetch(`${API}/api/cuentas/perfil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      if (!r.ok) throw new Error('No se pudo guardar');
      setPerfil((p) => ({ ...p, ...cambios }));
      setAviso('Guardado.');
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCodigo = async (e) => {
    e.preventDefault();
    setVerificando(true);
    setError('');
    setAviso('');
    try {
      await verificar({ email: perfil.email, code: codigo });
      setPerfil((p) => ({ ...p, email_verified: true }));
      setAviso('Correo confirmado.');
      setCodigo('');
    } catch (err) {
      setError(err.message);
    } finally {
      setVerificando(false);
    }
  };

  const borrar = async () => {
    setBorrando(true);
    setError('');
    try {
      const r = await cuentaFetch(`${API}/api/cuentas/perfil`, { method: 'DELETE' });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.detail || 'No se pudo borrar la cuenta');
      cerrarSesionCuenta();
      navigate('/');
    } catch (e) {
      setError(e.message);
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  };

  if (cargando) {
    return (
      <div className="pt-24 pb-16 flex justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Tu cuenta</CardTitle>
            </CardHeader>
            <CardContent>
              <CuentaAcceso
                motivo="Entra o crea una cuenta para seguir a los corredores y firmar tus mensajes."
                onListo={cargar}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const roles = perfil.roles || ['fan'];
  const esSoloEspectador = roles.length === 1 && roles[0] === 'fan';
  const necesitaConfirmar = !esSoloEspectador && !perfil.email_verified;

  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <UserCircle2 className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{perfil.nombre}</h1>
            <p className="text-sm text-muted-foreground">{perfil.email}</p>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>}
        {aviso && (
          <div className="p-3 rounded-lg bg-green-100 text-green-800 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />{aviso}
          </div>
        )}

        {/* El espectador no confirma nada: su cuenta no da acceso a nada que no
            sea ya público. El código aparece solo cuando la cuenta gana un rol
            con consecuencias detrás —corredor o equipo—, donde hay
            inscripciones, pagos, fichas médicas y turnos. */}
        {necesitaConfirmar && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MailX className="w-5 h-5 text-amber-600" />
                Confirma tu correo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tu cuenta ya no es solo de espectador, así que necesitamos confirmar que
                el correo es tuyo. Te enviamos un código de seis dígitos.
              </p>
              <form onSubmit={confirmarCodigo} className="flex gap-2">
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                />
                <Button type="submit" disabled={verificando || codigo.length < 6}>
                  {verificando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </Button>
              </form>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reenviarCodigo(perfil.email);
                  setAviso('Si tu correo sigue sin confirmar, te enviamos otro código.');
                }}
              >
                Enviarme otro código
              </Button>
            </CardContent>
          </Card>
        )}

        {perfil.email_verified && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <MailCheck className="w-4 h-4" />
            Correo confirmado
          </div>
        )}

        {esSoloEspectador && (
          <p className="text-sm text-muted-foreground">
            Tu cuenta es de espectador: sirve para firmar tus mensajes, seguir a los
            corredores y recibir avisos si los quieres. No hay nada más que confirmar.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avisos de la carrera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!perfil.acepta_comunicaciones}
                disabled={guardando}
                onChange={(e) => guardar({ acepta_comunicaciones: e.target.checked })}
                className="mt-1"
              />
              <span>
                Quiero recibir avisos de la carrera por correo. Es lo único que decide
                si te escribimos: puedes desmarcarlo cuando quieras y deja de aplicarse
                de inmediato.
              </span>
            </label>
            {perfil.followed?.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                Sigues a {perfil.followed.length} corredor{perfil.followed.length === 1 ? '' : 'es'}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos opcionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Puedes dejarlos vacíos. Solo nos sirven para saber quién sigue la carrera.
            </p>
            <div>
              <label className="text-sm font-medium" htmlFor="cuenta-pais">País</label>
              <Input
                id="cuenta-pais"
                defaultValue={perfil.pais || ''}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (perfil.pais || '')) guardar({ pais: v });
                }}
                maxLength={60}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg">Cerrar o borrar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => { cerrarSesionCuenta(); navigate('/'); }}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>

            {!confirmandoBorrado ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmandoBorrado(true)}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Borrar mi cuenta
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-3">
                <p className="text-sm text-red-800">
                  Se borran tu correo, tu nombre y la lista de a quién sigues. Los mensajes
                  de ánimo que escribiste se quedan en el hilo público firmados con tu
                  nombre, porque forman parte de conversaciones de otras personas. Esto no
                  se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={borrar} disabled={borrando} className="flex-1">
                    {borrando
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Trash2 className="w-4 h-4 mr-2" />}
                    Sí, borrarla
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmandoBorrado(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          <Link to="/privacidad" className="text-primary hover:underline">
            Cómo tratamos tus datos
          </Link>
        </p>
      </div>
    </div>
  );
}
