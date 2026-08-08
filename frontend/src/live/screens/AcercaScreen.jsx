import React from 'react';
import { Mail, Globe, Phone, Info } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { openExternal } from '../../lib/nativeExport';
import { VERSION, REVISION, FECHA_BUILD } from '../version';

const CONTACTO = {
  email: 'backyardultrasantodomingo@gmail.com',
  web: 'https://www.backyardultrasantodomingo.com',
  webTexto: 'www.backyardultrasantodomingo.com',
  telefono: '+1 (829) 656-4040',
  telefonoLlamada: '+18296564040',
};

/**
 * Acerca de: qué versión tiene instalada y cómo contactar con la organización.
 *
 * La revisión no es adorno: cuando alguien dice "me pasa esto", lo primero que
 * hace falta saber es qué build tiene en el teléfono, porque conviven la del
 * navegador, la de Android y la de iOS.
 */
export default function AcercaScreen() {
  const { T } = useLiveTheme();

  return (
    <Screen title="Acerca de" back>
      <div className="px-4 py-5 space-y-4">
        <div className={`rounded-2xl px-4 py-5 text-center ${T.card}`}>
          <p className="font-extrabold tracking-wide text-lg">
            BYSD <span className="text-[#E77622]">LIVE</span>
          </p>
          <p className={`text-xs mt-1 ${T.muted}`}>Backyard Ultra Santo Domingo</p>
          <p className="text-sm font-bold mt-3">Versión {VERSION}</p>
          <p className={`text-[11px] mt-0.5 ${T.subtle}`}>
            {REVISION ? `Revisión ${REVISION}` : 'Revisión no disponible'}
            {FECHA_BUILD ? ` · ${FECHA_BUILD}` : ''}
          </p>
        </div>

        <div className={`rounded-2xl ${T.card}`}>
          <p className={`px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#E77622]`}>
            Contacto
          </p>

          <a
            href={`mailto:${CONTACTO.email}`}
            className={`flex items-center gap-3.5 px-4 py-3.5 border-b ${T.divider}`}
          >
            <Mail className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-wide ${T.subtle}`}>Correo</p>
              <p className="text-sm font-semibold break-all">{CONTACTO.email}</p>
            </div>
          </a>

          <button
            onClick={() => openExternal(CONTACTO.web)}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left border-b ${T.divider}`}
          >
            <Globe className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-wide ${T.subtle}`}>Web</p>
              <p className="text-sm font-semibold break-all">{CONTACTO.webTexto}</p>
            </div>
          </button>

          <a href={`tel:${CONTACTO.telefonoLlamada}`} className="flex items-center gap-3.5 px-4 py-3.5">
            <Phone className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-wide ${T.subtle}`}>Teléfono</p>
              <p className="text-sm font-semibold">{CONTACTO.telefono}</p>
            </div>
          </a>
        </div>

        <p className={`text-[10px] flex items-center justify-center gap-1.5 text-center ${T.subtle}`}>
          <Info className="w-3 h-3" /> Si reportas un problema, indica la versión y la revisión
        </p>
      </div>
    </Screen>
  );
}
