import React, { useState } from 'react';
import { Loader2, Mail, UserPlus, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { registrarse, entrar } from '../lib/cuentaApi';

/**
 * Crear cuenta o entrar, para quien viene a seguir la carrera.
 *
 * Se piden tres cosas y no más: correo, nombre y el consentimiento. Cada campo
 * de más cuesta altas, y lo demás —país, de qué conoce la carrera— se puede
 * rellenar luego desde el perfil si a la persona le apetece.
 *
 * El alta no espera a la verificación del correo: quien se registra para animar
 * a alguien que está corriendo ahora mismo no puede quedarse mirando la bandeja
 * de entrada. El código sale detrás, y hasta que lo confirme la cuenta queda
 * marcada como sin verificar, que es lo que la deja fuera de los envíos.
 *
 * La casilla de comunicaciones va aparte y sin marcar: tener cuenta no es haber
 * aceptado que le escriban.
 *
 * Componente a nivel de módulo, no definido dentro del render de la página que
 * lo usa: anidarlo haría que React lo remontara en cada tecla y los campos
 * perderían el foco a la primera letra.
 */
export default function CuentaAcceso({ onListo, motivo }) {
  const [modo, setModo] = useState('registro');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const esRegistro = modo === 'registro';

  const enviar = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Faltan el correo y la contraseña.');
      return;
    }
    if (esRegistro && !nombre.trim()) {
      setError('Escribe tu nombre: es el que firma tus mensajes.');
      return;
    }
    if (esRegistro && password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      const cuenta = esRegistro
        ? await registrarse({ email, nombre, password, aceptaComunicaciones: acepta })
        : await entrar({ email, password });
      onListo?.(cuenta);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      {motivo && <p className="text-sm text-gray-600">{motivo}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant={esRegistro ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => { setModo('registro'); setError(''); }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Crear cuenta
        </Button>
        <Button
          type="button"
          variant={!esRegistro ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => { setModo('acceso'); setError(''); }}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Ya tengo
        </Button>
      </div>

      {esRegistro && (
        <div>
          <label className="text-sm font-medium" htmlFor="cuenta-nombre">Tu nombre</label>
          <Input
            id="cuenta-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Con el que firmas tus mensajes"
            maxLength={80}
            autoComplete="name"
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium" htmlFor="cuenta-email">Correo</label>
        <Input
          id="cuenta-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="cuenta-password">Contraseña</label>
        <Input
          id="cuenta-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={esRegistro ? 'Al menos 8 caracteres' : ''}
          autoComplete={esRegistro ? 'new-password' : 'current-password'}
        />
      </div>

      {esRegistro && (
        <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-1"
          />
          <span>
            Quiero recibir avisos de la carrera por correo. Puedes cambiarlo cuando
            quieras desde tu perfil.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
          : esRegistro
            ? <><UserPlus className="w-4 h-4 mr-2" />Crear cuenta y continuar</>
            : <><LogIn className="w-4 h-4 mr-2" />Entrar</>}
      </Button>

      {esRegistro && (
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Te mandamos un código para confirmar el correo, pero no hace falta
          esperarlo: puedes seguir ahora mismo.
        </p>
      )}

      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Solo guardamos tu correo y tu nombre. Puedes borrar la cuenta cuando
        quieras.
      </p>
    </form>
  );
}
