import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Lo que abre el QR del carnet de staff: si el carnet es bueno y de quién es.
 *
 * Es para el que controla un acceso y quiere comprobar que quien lo lleva es
 * del equipo. Solo muestra nombre, puesto y evento; los datos médicos van en
 * el carnet impreso y no salen aquí.
 */
export default function VerificarCarnetPage() {
  const { codigo } = useParams();
  const [estado, setEstado] = useState('cargando');
  const [carnet, setCarnet] = useState(null);

  useEffect(() => {
    let vigente = true;
    fetch(`${API_URL}/api/staff/carnet/verificar/${encodeURIComponent(codigo)}`)
      .then(async (res) => {
        if (!vigente) return;
        if (!res.ok) {
          setEstado('no_existe');
          return;
        }
        const datos = await res.json();
        setCarnet(datos);
        setEstado(datos.valido ? 'valido' : 'anulado');
      })
      .catch(() => vigente && setEstado('error'));
    return () => { vigente = false; };
  }, [codigo]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-24">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-8 text-center">
          {estado === 'cargando' && (
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          )}

          {estado === 'valido' && (
            <>
              <BadgeCheck className="w-14 h-14 text-green-600 mx-auto" />
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-green-700">
                Staff acreditado
              </p>
              <h1 className="mt-4 text-2xl font-bold">{carnet.nombre}</h1>
              <p className="mt-1 text-muted-foreground">{carnet.puesto}</p>
              <p className="mt-4 text-sm">{carnet.evento}</p>
              <p className="mt-1 text-xs text-muted-foreground">Carnet {carnet.numero}</p>
            </>
          )}

          {(estado === 'anulado' || estado === 'no_existe') && (
            <>
              <ShieldX className="w-14 h-14 text-red-600 mx-auto" />
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-red-700">
                Carnet no válido
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {estado === 'anulado'
                  ? `El registro de ${carnet.nombre} en el staff fue cancelado.`
                  : 'Este carnet no corresponde a ningún miembro del staff.'}
              </p>
            </>
          )}

          {estado === 'error' && (
            <p className="text-sm text-muted-foreground">
              No se pudo comprobar el carnet. Revisa la conexión e inténtalo de nuevo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
