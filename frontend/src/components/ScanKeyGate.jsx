import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { saveScanKey } from '../lib/adminApi';

/**
 * Pide la clave de escaneo de la carrera.
 *
 * Registrar vueltas y marcar DNF ya no es una URL abierta: hace falta la clave
 * que da la organización (o haber entrado al panel). Se escribe una vez por
 * dispositivo y queda guardada.
 */
export default function ScanKeyGate({ onReady, mensaje }) {
  const [valor, setValor] = useState('');
  const [verificando, setVerificando] = useState(false);

  const guardar = (e) => {
    e.preventDefault();
    const clave = valor.trim().toUpperCase();
    if (!clave) return;
    setVerificando(true);
    saveScanKey(clave);
    onReady?.(clave);
    setVerificando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Clave de escaneo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {mensaje || 'Escribe la clave que te dio la organización para registrar vueltas.'}
          </p>
          <form onSubmit={guardar} className="space-y-3">
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value.toUpperCase())}
              placeholder="Ej. K7QM4"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="text-center text-2xl tracking-[0.3em] font-mono"
              data-testid="input-scan-key"
            />
            <Button type="submit" className="w-full" disabled={!valor.trim() || verificando}>
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
