import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  UtensilsCrossed, Coffee, Soup, Moon, Cookie, Users, RefreshCw, Loader2, Download,
  Clock, ChevronDown, ChevronRight, Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EVENTOS = [
  { value: 'carrera', label: 'Carrera Activa' },
  { value: 'campeonato', label: 'Campeonato Mundial por Equipos' },
];

// El orden en que se muestran y se exportan las cuatro cuentas
const TIPOS = [
  { key: 'refrigerio', label: 'Refrigerios', icon: Cookie, clase: 'bg-slate-50 border-slate-200 text-slate-700' },
  { key: 'desayuno', label: 'Desayunos', icon: Coffee, clase: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'almuerzo', label: 'Almuerzos', icon: Soup, clase: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'cena', label: 'Cenas', icon: Moon, clase: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
];

const celdaCSV = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

// Etiqueta en singular para el detalle de una entrega
const NOMBRE_TIPO = {
  refrigerio: 'Refrigerio',
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
};

export default function VolunteerMealsPanel() {
  const [evento, setEvento] = useState('carrera');
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [abiertos, setAbiertos] = useState([]);
  const [imprimiendo, setImprimiendo] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${API_URL}/api/volunteers/alimentacion?evento=${evento}`);
      if (!res.ok) throw new Error('No se pudo calcular la alimentación');
      setDatos(await res.json());
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
      setDatos(null);
    } finally {
      setLoading(false);
    }
  }, [evento]);

  useEffect(() => { loadData(); }, [loadData]);

  const voluntarios = datos?.voluntarios || [];
  const totales = datos?.totales || {};
  const porDia = datos?.por_dia || [];
  const entregas = useMemo(() => datos?.entregas || [], [datos]);

  // Las entregas agrupadas por el momento en que se reparten: es como se
  // trabaja en la mesa de comida, una hora cada vez.
  const momentos = useMemo(() => {
    const mapa = new Map();
    entregas.forEach((e) => {
      const clave = `${e.dia} ${e.hora}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, { clave, dia: e.dia, hora: e.hora, total: 0, porTipo: {} });
      }
      const momento = mapa.get(clave);
      momento.total += e.cantidad;
      (momento.porTipo[e.tipo] = momento.porTipo[e.tipo] || []).push(e);
    });
    return [...mapa.values()];
  }, [entregas]);

  // Una línea puede llevar dos raciones: quien encadena 04-08 con 08-12 recoge
  // sus dos refrigerios en la mesa de las 9:30.
  const raciones = (lista) => lista.reduce((suma, e) => suma + e.cantidad, 0);
  const totalRaciones = useMemo(() => raciones(entregas), [entregas]);

  const alternar = (clave) =>
    setAbiertos((previos) =>
      previos.includes(clave) ? previos.filter((c) => c !== clave) : [...previos, clave]
    );

  // La cocina trabaja con la hoja; la pantalla es para mirar el total.
  const exportarCSV = () => {
    if (voluntarios.length === 0) {
      toast.error('No hay voluntarios con turnos asignados');
      return;
    }

    const cabeceras = [
      'Voluntario', 'Email', 'Turnos', 'Horas',
      'Refrigerios', 'Desayunos', 'Almuerzos', 'Cenas', 'Jornadas',
    ];
    const filas = voluntarios.map((v) => [
      v.nombre,
      v.email,
      v.turnos,
      v.horas,
      v.refrigerio,
      v.desayuno,
      v.almuerzo,
      v.cena,
      (v.jornadas || []).map((j) => `${j.dia} ${j.desde}-${j.hasta}`).join(' | '),
    ]);
    filas.push([
      'TOTAL', '', '', '',
      totales.refrigerio, totales.desayuno, totales.almuerzo, totales.cena, '',
    ]);

    const contenido = '﻿' + [cabeceras, ...filas]
      .map((fila) => fila.map(celdaCSV).join(','))
      .join('\n');

    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
    enlace.download = `alimentacion-voluntarios-${evento}-${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    toast.success(`${voluntarios.length} voluntario(s) exportado(s)`);
  };

  // La hoja de reparto: una línea por ración, con su casilla para marcar.
  const exportarEntregasCSV = () => {
    if (entregas.length === 0) {
      toast.error('No hay entregas que listar');
      return;
    }

    const cabeceras = [
      'Fecha', 'Hora', 'Comida', 'Cantidad', 'Voluntario', 'Email', 'Puesto', 'Turno', 'Entregado',
    ];
    const filas = entregas.map((e) => [
      e.dia,
      e.hora,
      NOMBRE_TIPO[e.tipo] || e.tipo,
      e.cantidad,
      e.nombre,
      e.email,
      e.puesto,
      `${e.turno} (${e.horario_turno})`,
      '',
    ]);

    const contenido = '\ufeff' + [cabeceras, ...filas]
      .map((fila) => fila.map(celdaCSV).join(','))
      .join('\n');

    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
    enlace.download = `entregas-alimentacion-${evento}-${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    toast.success(`${totalRaciones} ración(es) exportada(s)`);
  };

  // Los tickets se recortan y se entregan con la camiseta del staff: cada uno
  // dice qué comida es, a qué hora se recoge y de quién es.
  const descargarTickets = async () => {
    setImprimiendo(true);
    try {
      const res = await adminFetch(`${API_URL}/api/volunteers/tickets-alimentacion?evento=${evento}`);
      if (!res.ok) throw new Error('No se pudieron generar los tickets');

      const blob = await res.blob();
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `tickets-alimentacion-${evento}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      URL.revokeObjectURL(enlace.href);
      enlace.remove();
      toast.success(`${totalRaciones} ticket(s) listos para imprimir`);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="volunteer-meals-panel">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Alimentación de Voluntarios</h2>
          <p className="text-muted-foreground">
            Cuánta comida hay que pedir, calculado desde los turnos asignados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={descargarTickets}
            disabled={loading || imprimiendo || entregas.length === 0}
            data-testid="export-tickets-pdf"
          >
            {imprimiendo ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Ticket className="w-4 h-4 mr-2" />
            )}
            Tickets (PDF)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarCSV}
            disabled={loading || voluntarios.length === 0}
            data-testid="export-alimentacion-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Resumen (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarEntregasCSV}
            disabled={loading || entregas.length === 0}
            data-testid="export-entregas-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Entregas (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Evento */}
      <div className="flex flex-wrap gap-2" data-testid="meals-event-filter">
        {EVENTOS.map((ev) => (
          <button
            key={ev.value}
            type="button"
            data-testid={`meals-event-${ev.value}`}
            onClick={() => setEvento(ev.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              evento === ev.value ? 'bg-primary text-white shadow' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {ev.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12" data-testid="meals-loading">
          <Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" />
          <span className="ml-2">Calculando alimentación...</span>
        </div>
      ) : (
        <>
          {/* Totales */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {TIPOS.map(({ key, label, icon: Icon, clase }) => (
              <Card key={key} className={clase} data-testid={`total-${key}`}>
                <CardContent className="p-4 text-center">
                  <Icon className="w-5 h-5 mx-auto mb-1 opacity-70" />
                  <div className="text-3xl font-bold">{totales[key] || 0}</div>
                  <div className="text-sm">{label}</div>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-blue-50 border-blue-200 text-blue-700">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 opacity-70" />
                <div className="text-3xl font-bold">{totales.voluntarios || 0}</div>
                <div className="text-sm">Voluntarios con turno</div>
              </CardContent>
            </Card>
          </div>

          {/* Por día: es lo que se le pide al suplidor cada mañana */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#E8772E]" />
                Por día
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="meals-by-day">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Día</th>
                      {TIPOS.map((t) => (
                        <th key={t.key} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {porDia.map((dia) => (
                      <tr key={dia.dia} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{dia.dia}</td>
                        {TIPOS.map((t) => (
                          <td key={t.key} className="px-4 py-2.5 text-right font-semibold">{dia[t.key]}</td>
                        ))}
                      </tr>
                    ))}
                    {porDia.length === 0 && (
                      <tr>
                        <td colSpan={TIPOS.length + 1} className="px-4 py-8 text-center text-gray-400">
                          No hay turnos asignados en este evento
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quien come y a que hora: la hoja de reparto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#E8772E]" />
                Entregas por fecha y hora
                <Badge variant="secondary">{totalRaciones}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Los refrigerios se reparten en cuatro mesas fijas: 01:00, 09:30, 14:30 y 20:30.
                Las comidas, en el cambio de turno. Abre una hora para ver quién recibe.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y" data-testid="meals-deliveries">
                {momentos.map((momento) => {
                  const abierto = abiertos.includes(momento.clave);
                  return (
                    <div key={momento.clave}>
                      <button
                        type="button"
                        onClick={() => alternar(momento.clave)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50"
                        data-testid={`delivery-${momento.clave}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {abierto ? (
                            <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="font-medium">{momento.dia}</span>
                          <span className="font-mono text-sm text-muted-foreground">{momento.hora}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {TIPOS.filter((t) => momento.porTipo[t.key]).map((t) => (
                            <Badge key={t.key} variant="outline" className={t.clase}>
                              {raciones(momento.porTipo[t.key])} {t.label.toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      </button>
                      {abierto && (
                        <div className="px-4 pb-4 space-y-3 bg-gray-50/60">
                          {TIPOS.filter((t) => momento.porTipo[t.key]).map((t) => (
                            <div key={t.key}>
                              <div className="text-xs font-medium uppercase text-muted-foreground py-2">
                                {t.label} ({raciones(momento.porTipo[t.key])})
                              </div>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                                {momento.porTipo[t.key].map((e, i) => (
                                  <div key={`${e.email}-${e.tipo}-${i}`} className="text-sm">
                                    <span className="font-medium">{e.nombre}</span>
                                    {e.cantidad > 1 && (
                                      <span className="font-semibold"> ×{e.cantidad}</span>
                                    )}
                                    <span className="text-muted-foreground"> · {e.puesto}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {momentos.length === 0 && (
                  <p className="px-4 py-8 text-center text-gray-400">
                    No hay entregas: nadie tiene turnos asignados en este evento
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Persona por persona */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-[#E8772E]" />
                Voluntario por voluntario
                <Badge variant="secondary">{voluntarios.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="meals-by-volunteer">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voluntario</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jornadas</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Horas</th>
                      {TIPOS.map((t) => (
                        <th key={t.key} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {voluntarios.map((v) => (
                      <tr key={v.email} className="hover:bg-gray-50" data-testid={`meals-row-${v.email}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{v.nombre}</div>
                          <div className="text-xs text-gray-400">{v.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {(v.jornadas || []).map((j, i) => (
                            <div key={i}>{j.dia} · {j.desde}-{j.hasta} ({j.turnos} turno{j.turnos !== 1 ? 's' : ''})</div>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-right">{v.horas}</td>
                        {TIPOS.map((t) => (
                          <td
                            key={t.key}
                            className={`px-4 py-2.5 text-right ${v[t.key] ? 'font-semibold' : 'text-gray-300'}`}
                          >
                            {v[t.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {voluntarios.length === 0 && (
                      <tr>
                        <td colSpan={TIPOS.length + 3} className="px-4 py-8 text-center text-gray-400">
                          No hay voluntarios con turnos asignados en este evento
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Las reglas, a la vista: el número de arriba se explica solo */}
          <Card className="bg-muted/40">
            <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Cómo se cuenta</p>
              <p>Un refrigerio por cada turno de 4 horas o más, que se recoge en una de las cuatro mesas del día: 01:00, 09:30, 14:30 y 20:30. A cada turno le toca la mesa que le cae dentro; el que no alcanza ninguna (16-20, 04-08) va a la más cercana, nunca antes de entrar.</p>
              <p>Turnos seguidos de madrugada a mañana: desayuno. De mañana a tarde: almuerzo. De tarde a noche: cena.</p>
              <p>La franja la da la hora de inicio del turno: madrugada desde las 00:00, mañana desde las 06:00, tarde desde las 12:00, noche desde las 18:00.</p>
              <p>Dos turnos son seguidos si no hay más de 30 minutos entre uno y otro. Quien tiene un solo turno, o turnos sueltos, se queda con su refrigerio.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
