import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CalendarRange, ChevronDown, ChevronUp } from 'lucide-react';

// Orden cronológico de los días
const DIA_ORDEN = ['previo', 'carrera', 'carrera_dia1', 'carrera_dia2', 'carrera_dia3'];

const DIA_LABEL = {
  previo: 'Día Previo',
  carrera: 'Día de Carrera',
  carrera_dia1: 'Día 1',
  carrera_dia2: 'Día 2',
  carrera_dia3: 'Día 3',
};

// Etiqueta corta de cada posición: A, B, C... y luego AA, AB...
const letraPosicion = (indice) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nombre = '';
  let n = indice + 1;
  while (n > 0) {
    const resto = (n - 1) % 26;
    nombre = letras[resto] + nombre;
    n = Math.floor((n - 1) / 26);
  }
  return nombre;
};

const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes || 0).padStart(2, '0')} ${period}`;
};

// Verde = completa, amarillo = a medio completar, rojo = pendiente
const estadoDeCelda = (asignados, total) => {
  if (!total) return { clave: 'vacio', clase: 'bg-gray-50 text-gray-300 border-gray-200' };
  if (asignados >= total) return { clave: 'llena', clase: 'bg-green-500 text-white border-green-600' };
  if (asignados > 0) return { clave: 'parcial', clase: 'bg-amber-400 text-amber-950 border-amber-500' };
  return { clave: 'pendiente', clase: 'bg-red-500 text-white border-red-600' };
};

export default function VolunteerCoverageMap({ slots = [] }) {
  const [abierto, setAbierto] = useState(true);

  const { posiciones, dias, resumen } = useMemo(() => {
    const nombresPosiciones = [...new Set(slots.map((s) => s.puesto).filter(Boolean))].sort();

    // dia_tipo -> turno -> puesto -> {asignados, total}
    const porDia = new Map();
    const totales = { llena: 0, parcial: 0, pendiente: 0, asignados: 0, cupos: 0 };

    for (const slot of slots) {
      const diaTipo = slot.dia_tipo || 'carrera';
      const turno = slot.turno || '?';
      const puesto = slot.puesto;
      if (!puesto) continue;

      if (!porDia.has(diaTipo)) porDia.set(diaTipo, new Map());
      const turnos = porDia.get(diaTipo);

      if (!turnos.has(turno)) {
        turnos.set(turno, {
          turno,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          celdas: new Map(),
        });
      }
      const filaTurno = turnos.get(turno);

      if (!filaTurno.celdas.has(puesto)) {
        filaTurno.celdas.set(puesto, { asignados: 0, total: 0 });
      }
      const celda = filaTurno.celdas.get(puesto);
      celda.total += 1;
      totales.cupos += 1;
      if (slot.email_asignado) {
        celda.asignados += 1;
        totales.asignados += 1;
      }
    }

    // Ordenar días y turnos, y contar estados
    const diasOrdenados = [...porDia.entries()]
      .sort((a, b) => {
        const ia = DIA_ORDEN.indexOf(a[0]);
        const ib = DIA_ORDEN.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([diaTipo, turnos]) => {
        const filas = [...turnos.values()].sort((a, b) => {
          const ha = (a.hora_inicio || '').localeCompare(b.hora_inicio || '');
          return ha !== 0 ? ha : a.turno.localeCompare(b.turno);
        });
        for (const fila of filas) {
          for (const celda of fila.celdas.values()) {
            totales[estadoDeCelda(celda.asignados, celda.total).clave] += 1;
          }
        }
        return { diaTipo, filas };
      });

    return { posiciones: nombresPosiciones, dias: diasOrdenados, resumen: totales };
  }, [slots]);

  const indicePosicion = useMemo(
    () => new Map(posiciones.map((p, i) => [p, i])),
    [posiciones]
  );

  if (!slots.length) return null;

  return (
    <Card data-testid="volunteer-coverage-map">
      <CardHeader className="pb-3">
        <div
          className="flex items-center justify-between gap-3 cursor-pointer flex-wrap"
          onClick={() => setAbierto((v) => !v)}
        >
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarRange className="w-5 h-5" />
            Mapa de Cobertura por Turno
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Llenas: <strong>{resumen.llena}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> A medio: <strong>{resumen.parcial}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Pendientes: <strong>{resumen.pendiente}</strong>
            </span>
            <span className="text-muted-foreground">
              {resumen.asignados}/{resumen.cupos} cupos cubiertos
            </span>
            {abierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </CardHeader>

      {abierto && (
        <CardContent className="space-y-6">
          {dias.map(({ diaTipo, filas }) => (
            <div key={diaTipo} className="space-y-2">
              <h4 className="text-sm font-semibold">{DIA_LABEL[diaTipo] || diaTipo}</h4>

              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-2 sticky left-0 bg-background">
                        Turno
                      </th>
                      {posiciones.map((puesto) => (
                        <th
                          key={puesto}
                          className="w-10 font-semibold text-muted-foreground"
                          title={puesto}
                        >
                          {letraPosicion(indicePosicion.get(puesto))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr key={fila.turno}>
                        <td className="whitespace-nowrap pr-3 sticky left-0 bg-background">
                          <span className="font-semibold">{fila.turno}</span>
                          <span className="text-muted-foreground ml-2">
                            {formatTime12h(fila.hora_inicio)} - {formatTime12h(fila.hora_fin)}
                          </span>
                        </td>
                        {posiciones.map((puesto) => {
                          const celda = fila.celdas.get(puesto);
                          const asignados = celda?.asignados || 0;
                          const total = celda?.total || 0;
                          const { clase } = estadoDeCelda(asignados, total);
                          return (
                            <td key={puesto} className="p-0">
                              <div
                                className={`w-10 h-8 rounded border flex items-center justify-center font-medium ${clase}`}
                                title={
                                  total
                                    ? `${puesto} · Turno ${fila.turno}: ${asignados} de ${total} cupos cubiertos`
                                    : `${puesto} · Turno ${fila.turno}: sin cupos configurados`
                                }
                                data-testid={`coverage-${diaTipo}-${fila.turno}-${letraPosicion(indicePosicion.get(puesto))}`}
                              >
                                {total ? `${asignados}/${total}` : '·'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Leyenda de las letras */}
          <div className="pt-4 border-t space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Posiciones</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {posiciones.map((puesto, i) => (
                <div key={puesto} className="text-xs flex gap-2">
                  <span className="font-bold w-6 shrink-0">{letraPosicion(i)}</span>
                  <span className="text-muted-foreground truncate" title={puesto}>{puesto}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Completa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> A medio completar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Pendiente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Sin cupos
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
