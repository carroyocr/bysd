import React, { useState } from 'react';
import { MailCheck, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  confirmarCorreo, reenviarCodigo, pedirCodigoRecuperacion, cambiarPasswordSinEntrar,
} from '../lib/cuentaApi';

/**
 * A donde lleva el correo "Confirma tu correo" de una cuenta del equipo.
 *
 * Quien se da de alta como staff en la app entra en el acto, pero su ficha de
 * voluntario, sus turnos y su carnet no aparecen hasta que confirma que el
 * correo es suyo. La app que ya está instalada no tiene dónde escribir el
 * código, así que se escribe aquí.
 *
 * Pide la contraseña además del código a propósito. El código demuestra que
 * quien lo escribe lee ese buzón; la contraseña, que es quien abrió la cuenta.
 * Con el código solo, el dueño del correo le confirmaría la cuenta a cualquiera
 * que la hubiera abierto con su dirección. Quien no tiene la contraseña —porque
 * la olvidó o porque la cuenta no la abrió él— se pone una nueva, que confirma
 * el correo igual y deja fuera a quien la abriera.
 */
export default function VerificarCuentaPage() {
  // confirmar | recuperar | nueva | listo
  const [paso, setPaso] = useState('confirmar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const ir = (destino) => {
    setPaso(destino);
    setError('');
    setAviso('');
    setCodigo('');
    setPassword('');
  };

  const correo = email.trim().toLowerCase();

  const confirmar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await confirmarCorreo({ email: correo, code: codigo.trim(), password });
      setPaso('listo');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const otroCodigo = async () => {
    if (!correo) { setError('Escribe primero tu correo.'); return; }
    setOcupado(true);
    setError('');
    try {
      await reenviarCodigo(correo);
      setAviso('Si ese correo tiene una cuenta sin confirmar, te enviamos otro código.');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const pedirCambio = async (e) => {
    e.preventDefault();
    if (!correo) { setError('Escribe tu correo.'); return; }
    setOcupado(true);
    setError('');
    try {
      await pedirCodigoRecuperacion(correo);
      ir('nueva');
      setAviso('Si ese correo tiene cuenta, te enviamos un código para cambiar la contraseña.');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const cambiar = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('La contraseña necesita al menos 8 caracteres.'); return; }
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await cambiarPasswordSinEntrar({ email: correo, code: codigo.trim(), password });
      setPaso('listo');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {paso === 'confirmar' || paso === 'listo'
                ? <MailCheck className="w-5 h-5 text-primary" />
                : <KeyRound className="w-5 h-5 text-primary" />}
              {paso === 'confirmar' && 'Confirma tu correo'}
              {paso === 'recuperar' && 'No recuerdo mi contraseña'}
              {paso === 'nueva' && 'Elige una contraseña nueva'}
              {paso === 'listo' && 'Correo confirmado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paso === 'listo' && (
              <p className="text-sm text-muted-foreground" data-testid="verificar-cuenta-listo">
                Listo. Abre la app, entra en Staff y abre tu perfil: ya aparecen tu
                ficha, tus turnos y tu carnet. Si cambiaste la contraseña, entra
                con la nueva.
              </p>
            )}

            {paso === 'confirmar' && (
              <form onSubmit={confirmar} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escribe el código de seis dígitos que te llegó por correo y la
                  contraseña con la que creaste tu cuenta del equipo.
                </p>
                <div>
                  <label className="text-sm font-medium" htmlFor="verificar-email">Correo</label>
                  <Input
                    id="verificar-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="verificar-password">Contraseña</label>
                  <Input
                    id="verificar-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="verificar-codigo">Código</label>
                  <Input
                    id="verificar-codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                <Button type="submit" disabled={ocupado || codigo.trim().length < 6} className="w-full">
                  {ocupado
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
                    : <><MailCheck className="w-4 h-4 mr-2" />Confirmar</>}
                </Button>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={otroCodigo}>
                    Enviarme otro código
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => ir('recuperar')}>
                    No recuerdo mi contraseña
                  </Button>
                </div>
              </form>
            )}

            {paso === 'recuperar' && (
              <form onSubmit={pedirCambio} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Te enviamos un código para elegir una contraseña nueva. Al
                  cambiarla, tu correo queda confirmado: no hace falta nada más.
                </p>
                <div>
                  <label className="text-sm font-medium" htmlFor="recuperar-email">Correo</label>
                  <Input
                    id="recuperar-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" disabled={ocupado} className="w-full">
                  {ocupado
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
                    : 'Enviarme el código'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => ir('confirmar')}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Volver
                </Button>
              </form>
            )}

            {paso === 'nueva' && (
              <form onSubmit={cambiar} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escribe el código nuevo que te acaba de llegar a {correo} y la
                  contraseña que quieres usar a partir de ahora.
                </p>
                <div>
                  <label className="text-sm font-medium" htmlFor="nueva-codigo">Código</label>
                  <Input
                    id="nueva-codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="nueva-password">Contraseña nueva</label>
                  <Input
                    id="nueva-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Al menos 8 caracteres"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" disabled={ocupado || codigo.trim().length < 6} className="w-full">
                  {ocupado
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
                    : <><KeyRound className="w-4 h-4 mr-2" />Cambiar contraseña y confirmar</>}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => ir('confirmar')}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Volver
                </Button>
              </form>
            )}

            {aviso && <p className="text-sm text-green-700">{aviso}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
