import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import { cerrarSesion } from '../lib/sesion';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MIN_PASSWORD = 12;

/**
 * Cambio de contraseña del usuario que tiene la sesión abierta.
 *
 * Antes no existía: cambiar la contraseña del panel obligaba a escribir el
 * hash a mano en la base de datos.
 */
export default function ChangePasswordDialog() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setAbierto(false);
    setActual('');
    setNueva('');
    setRepetida('');
  };

  const guardar = async (e) => {
    e.preventDefault();

    if (nueva !== repetida) {
      toast.error('La contraseña nueva y su repetición no coinciden');
      return;
    }
    if (nueva.length < MIN_PASSWORD) {
      toast.error(`La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres`);
      return;
    }

    setGuardando(true);
    try {
      const res = await adminFetch(`${API_URL}/api/cuenta/cambiar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_actual: actual, password_nueva: nueva }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success('Contraseña actualizada. Vuelve a iniciar sesión.');
        cerrar();
        // La sesión vigente sigue siendo válida hasta que expire, pero forzar
        // el login deja claro que la contraseña nueva es la que manda.
        cerrarSesion();
        window.location.href = '/admin/login';
      } else {
        toast.error(data.detail || 'No se pudo cambiar la contraseña');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) {
    return (
      <Button variant="outline" onClick={() => setAbierto(true)} data-testid="btn-cambiar-password">
        <KeyRound className="w-4 h-4 mr-2" />
        Cambiar contraseña
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={guardar}
        className="w-full max-w-sm space-y-4 rounded-xl bg-background p-6 shadow-lg"
      >
        <h2 className="text-lg font-bold flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Cambiar contraseña
        </h2>

        <div className="space-y-2">
          <Label htmlFor="password-actual">Contraseña actual</Label>
          <Input
            id="password-actual"
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password-nueva">Contraseña nueva</Label>
          <Input
            id="password-nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted-foreground">Mínimo {MIN_PASSWORD} caracteres.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password-repetida">Repite la nueva</Label>
          <Input
            id="password-repetida"
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
