import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Flag } from 'lucide-react';

// El ranking oficial por equipos del Campeonato Mundial, de todos los países,
// con República Dominicana señalada. Sale de `/api/overlay/mundial/ranking`,
// que lee la hoja pública de la organización (la misma que alimenta su
// sitio de resultados): aquí no se recalcula nada. Si la hoja no responde,
// el bloque no se pinta.

const API_URL = process.env.REACT_APP_BACKEND_URL;
const NOSOTROS = 'DOM';
const PRIMEROS = 10;

const ordinal = (n, femenino = true) => (n == null ? '—' : `${n}.${femenino ? 'ª' : 'º'}`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-DO'));

function Cifra({ etiqueta, valor, detalle }) {
  return (
    <div className="py-4 md:border-r border-border last:border-r-0 md:px-5 md:first:pl-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{etiqueta}</div>
      <div className="font-display text-5xl leading-none text-foreground mt-2">{valor}</div>
      {detalle && <div className="text-xs text-muted-foreground mt-1.5">{detalle}</div>}
    </div>
  );
}

// Barras horizontales de vueltas por equipo: los diez primeros del mundo y
// todos los de Latinoamérica, en el orden oficial. Una sola serie en el azul
// del sitio; el nuestro va lleno y el resto en gris, con el país en texto.
function Barras({ equipos, maximo }) {
  return (
    <ol className="space-y-1.5" data-testid="ranking-mundial-barras">
      {equipos.map((e) => {
        const nuestro = e.codigo === NOSOTROS;
        const ancho = maximo ? Math.max(2, (e.vueltas / maximo) * 100) : 0;
        return (
          <li key={e.codigo} className="grid grid-cols-[2.5rem_minmax(7rem,12rem)_1fr_3.5rem] items-center gap-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground text-right">{e.puesto_mundial}</span>
            <span className={`truncate ${nuestro ? 'font-semibold text-foreground' : 'text-foreground/85'}`}>
              {e.pais}
              {e.latam && !nuestro && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">LatAm</span>}
            </span>
            <span className="block h-3 rounded-sm bg-secondary" aria-hidden="true">
              <span
                className={`block h-full rounded-sm ${nuestro ? 'bg-primary' : 'bg-muted-foreground/35'}`}
                style={{ width: `${ancho}%` }}
              />
            </span>
            <span className={`text-right tabular-nums ${nuestro ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{num(e.vueltas)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function RankingMundial() {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetch(`${API_URL}/api/overlay/mundial/ranking`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, []);

  const r = useMemo(() => {
    const equipos = datos?.equipos || [];
    if (!equipos.length) return null;
    const latam = equipos.filter((e) => e.latam);
    const nosotros = equipos.find((e) => e.codigo === NOSOTROS) || null;
    const puestoLatam = nosotros ? latam.findIndex((e) => e.codigo === NOSOTROS) + 1 : null;
    const destacados = equipos.filter((e, i) => i < PRIMEROS || e.latam || e.codigo === NOSOTROS);
    return {
      equipos,
      latam,
      nosotros,
      puestoLatam,
      destacados,
      campeon: equipos[0],
      paises: datos.paises || equipos.length,
      corredores: datos.corredores,
      maximo: Math.max(...equipos.map((e) => e.vueltas || 0)),
    };
  }, [datos]);

  if (!r) return null;
  const { nosotros: dom } = r;

  return (
    <div data-testid="ranking-mundial">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">En el mundo</p>
      <p className="text-base text-muted-foreground mt-3 max-w-3xl">
        {dom ? (
          <>
            República Dominicana terminó <strong className="text-foreground">{ordinal(dom.puesto_mundial)} de {r.paises} países</strong>
            {r.puestoLatam ? <> y <strong className="text-foreground">{ordinal(r.puestoLatam)} de {r.latam.length} de Latinoamérica</strong></> : null}
            , con {num(dom.vueltas)} vueltas sumadas por el equipo.
          </>
        ) : (
          <>En el Mundial compitieron {r.paises} países.</>
        )}
        {r.campeon && <> {r.campeon.pais} ganó el campeonato con {num(r.campeon.vueltas)} vueltas.</>}
        {r.corredores && <> Corrieron {num(r.corredores)} atletas en todo el mundo, a la misma hora.</>}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-border mt-4">
        <Cifra etiqueta="Puesto mundial" valor={dom ? dom.puesto_mundial : '—'} detalle={`de ${r.paises} países`} />
        <Cifra etiqueta="Latinoamérica" valor={r.puestoLatam || '—'} detalle={`de ${r.latam.length} equipos`} />
        <Cifra etiqueta="Países" valor={r.paises} detalle="selecciones en carrera" />
        <Cifra etiqueta="Atletas" valor={num(r.corredores)} detalle="en todo el mundo" />
      </div>

      <div className="mt-8">
        <h4 className="font-display uppercase text-2xl leading-none text-foreground">Ranking por equipos</h4>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Vueltas sumadas por cada selección: los {PRIMEROS} primeros del mundo y todos los equipos de Latinoamérica, en el orden oficial.
        </p>
        <Barras equipos={r.destacados} maximo={r.maximo} />
        <details className="mt-5 group">
          <summary className="cursor-pointer text-sm font-semibold text-primary inline-flex items-center gap-2 list-none">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span className="group-open:hidden">Ver los {r.paises} países</span>
            <span className="hidden group-open:inline">Ocultar la tabla completa</span>
          </summary>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm min-w-[480px]" data-testid="ranking-mundial-tabla">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">#</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">País</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Vueltas</th>
                  <th className="text-right py-2 pl-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {r.equipos.map((e) => {
                  const nuestro = e.codigo === NOSOTROS;
                  return (
                    <tr key={e.codigo} className={`border-b border-border ${nuestro ? 'bg-secondary font-semibold' : ''}`}>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{e.puesto_mundial}</td>
                      <td className="py-2 px-3 text-foreground">
                        {nuestro && <Flag className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-primary" aria-hidden="true" />}
                        {e.pais}
                        {e.latam && !nuestro && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">LatAm</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-foreground">{num(e.vueltas)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">{e.promedio || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-xs text-muted-foreground mt-3">
          Fuente: el leaderboard oficial por equipos de la organización del Campeonato Mundial, tal como lo publica, sin recalcular.
        </p>
      </div>
    </div>
  );
}
