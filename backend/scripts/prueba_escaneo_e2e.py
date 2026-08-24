# Bateria exhaustiva del sistema de escaneo, contra PRODUCCION.
# Solo escribe en la carrera TEST-2026. Ejecutar con el venv del backend.
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

API = 'https://bysd-backend.onrender.com'
RACE = 'TEST-2026'
KEY = 'PRUEB'
URI = open(os.path.expanduser('~/Proyectos/bysd-secretos/atlas_propio_url.txt')).read().strip()

resultados = []


def check(nombre, cond, detalle=''):
    resultados.append((nombre, bool(cond), detalle))
    print(('PASS' if cond else 'FAIL'), '-', nombre, ('· ' + str(detalle)[:110] if not cond else ''))


def ahora():
    return datetime.now(timezone.utc)


class Suite:
    def __init__(self):
        self.db = AsyncIOMotorClient(URI).backyard_ultra
        self.http = httpx.AsyncClient(timeout=30)
        self.token_staff = None      # demo staff: scanner, sin control
        self.key_2027 = None

    # ---------- utilidades ----------

    async def reset(self, salida_hace_min):
        """Deja TEST-2026 recien salida: libro vacio, todos activos con 0 vueltas."""
        inicio = ahora() - timedelta(minutes=salida_hace_min)
        await self.db.lap_registrations.delete_many({'race_code': RACE})
        await self.db.registrations.update_many(
            {'race_code': RACE},
            {'$set': {'status': 'active', 'laps_completed': 0, 'total_km': 0},
             '$unset': {'won_at': '', 'retired_at': '', 'retired_at_lap': '', 'retired_reason': ''}})
        await self.db.race_configurations.update_one(
            {'code': RACE},
            {'$set': {'estado': 'en_carrera', 'started_at': inicio},
             '$unset': {'finished_at': ''}})

    async def reloj(self, minutos):
        await self.db.race_configurations.update_one(
            {'code': RACE}, {'$set': {'started_at': ahora() - timedelta(minutes=minutos)}})

    async def confirm(self, body, headers):
        r = await self.http.post(f'{API}/api/qr-scan/confirm', json=body, headers=headers)
        return r.status_code, (r.json() if r.headers.get('content-type', '').startswith('application/json') else {})

    async def sync(self, scans, headers):
        r = await self.http.post(f'{API}/api/qr-scan/sync-offline',
                                 json={'race_code': RACE, 'scans': scans}, headers=headers)
        return r.status_code, (r.json() if r.headers.get('content-type', '').startswith('application/json') else {})

    async def athlete(self, bib, headers, race=RACE):
        r = await self.http.get(f'{API}/api/qr-scan/athlete/{bib}?race_code={race}', headers=headers)
        return r.status_code, (r.json() if r.headers.get('content-type', '').startswith('application/json') else {})

    async def atleta_db(self, bib):
        return await self.db.registrations.find_one({'race_code': RACE, 'bib': bib})

    def kh(self):
        return {'X-Scan-Key': KEY}

    def th(self):
        return {'Authorization': f'Bearer {self.token_staff}'}

    # ---------- preparacion ----------

    async def preparar(self):
        r = await self.http.post(f'{API}/api/cuentas/login', json={
            'email': 'carroyo.cr+demo.staff@gmail.com', 'password': 'Demo-Staff-2026'})
        self.token_staff = r.json()['token']
        otra = await self.db.race_configurations.find_one({'code': 'BYSD-2027'}, {'scan_key': 1})
        self.key_2027 = (otra or {}).get('scan_key')
        # Sin push de spam a los telefonos durante la corrida
        await self.db.push_devices.update_many({'race_code': RACE}, {'$set': {'followed': []}})

    # ---------- bloques ----------

    async def bloque_seguridad(self):
        print('\n== A. Seguridad y accesos ==')
        await self.reset(40)
        s, _ = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE}, {})
        check('A1 confirm sin credenciales -> 401', s == 401, s)
        s, _ = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE}, {'X-Scan-Key': 'XXXXX'})
        check('A2 confirm clave inexistente -> 401', s == 401, s)
        if self.key_2027:
            s, d = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE},
                                      {'X-Scan-Key': self.key_2027})
            check('A3 clave de otra carrera -> 403', s == 403, (s, d))
            s, d = await self.sync([], {'X-Scan-Key': self.key_2027})
            check('A4 sync con clave de otra carrera -> 403', s == 403, (s, d))
        s, _ = await self.sync([], {'X-Scan-Key': 'XXXXX'})
        check('A5 sync clave inexistente -> 401', s == 401, s)
        r = await self.http.post(f'{API}/api/race/mark-winner?race_code={RACE}',
                                 json={'bib': '901'}, headers=self.th())
        check('A6 mark-winner sin permiso control -> 403', r.status_code == 403, r.status_code)
        s, _ = await self.athlete('901', {})
        check('A7 consultar atleta sin credenciales -> 401', s == 401, s)
        if self.key_2027:
            s, _ = await self.athlete('901', {'X-Scan-Key': self.key_2027})
            check('A8 consultar con clave de otra carrera -> 403', s == 403, s)
        s, _ = await self.athlete('777', self.kh())
        check('A9 dorsal inexistente -> 404', s == 404, s)
        s, _ = await self.athlete('901', self.kh(), race='NOEXISTE-9')
        check('A10 carrera inexistente -> 404', s == 404, s)
        s, d = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE}, self.kh())
        check('A11 la clave PRUEB si autentica su carrera', s == 200, (s, d))

    async def bloque_estados(self):
        print('\n== B. Estados de la consulta ==')
        await self.reset(40)  # vuelta 1, minuto 40
        s, d = await self.athlete('901', self.kh())
        check('B1 ventana valida: can_complete', s == 200 and d.get('can_complete') and d.get('lap_to_complete') == 1, d)
        await self.reloj(10)
        s, d = await self.athlete('901', self.kh())
        check('B2 regreso temprano: early_return + auto_dnf', d.get('early_return') and d.get('auto_dnf'), d)
        await self.reloj(70)  # vuelta 2 m10: la vuelta 1 vencio
        s, d = await self.athlete('901', self.kh())
        check('B3 tiempo agotado: auto_dnf sin early', d.get('auto_dnf') and not d.get('early_return'), d)
        await self.db.race_configurations.update_one(
            {'code': RACE}, {'$set': {'started_at': ahora() + timedelta(hours=1)}})
        s, d = await self.athlete('901', self.kh())
        check('B4 antes de la salida: no puede completar', not d.get('can_complete') and d.get('current_race_lap') == 0, d)

    async def bloque_confirm(self):
        print('\n== C. Confirmacion en linea ==')
        await self.reset(40)
        t_scan = (ahora() - timedelta(minutes=2)).isoformat()
        s, d = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE,
                                   'scanned_at': t_scan, 'scanned_by': 'suite'}, self.kh())
        check('C1 vuelta valida con hora de escaneo', s == 200 and d.get('action') == 'lap_completed', d)
        reg = await self.db.lap_registrations.find_one({'race_code': RACE, 'bib': '901', 'lap_number': 1})
        delta = abs((reg['scan_time'].replace(tzinfo=timezone.utc) - datetime.fromisoformat(t_scan)).total_seconds())
        check('C2 el libro guarda la hora del escaneo', delta < 2, delta)
        a = await self.atleta_db('901')
        check('C3 contador recalculado (1 vuelta, 6.7 km)', a['laps_completed'] == 1 and a['total_km'] == 6.7, a['total_km'])
        s, d = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE}, self.kh())
        check('C4 duplicado -> already_registered sin error', s == 200 and d.get('action') == 'already_registered', d)
        s, d = await self.confirm({'bib': '902', 'confirmed_lap': 5, 'race_code': RACE}, self.kh())
        check('C5 vuelta desincronizada -> 400', s == 400, (s, d))
        s, d = await self.confirm({'bib': '902', 'confirmed_lap': 1, 'race_code': RACE}, self.th())
        check('C6 confirmar con token del panel tambien vale', s == 200 and d.get('action') == 'lap_completed', d)
        s, d = await self.confirm({'bib': '903', 'confirmed_lap': 1, 'race_code': RACE, 'force_dnf': True}, self.kh())
        check('C7 DNF manual sin escribir DNF -> 400', s == 400, (s, d))
        s, d = await self.confirm({'bib': '903', 'confirmed_lap': 1, 'race_code': RACE,
                                   'force_dnf': True, 'dnf_confirmation': 'DNF'}, self.kh())
        a = await self.atleta_db('903')
        check('C8 DNF manual retira al corredor', s == 200 and d.get('action') == 'dnf' and a['status'] == 'retired', d)
        futuro = (ahora() + timedelta(minutes=30)).isoformat()
        s, d = await self.confirm({'bib': '904', 'confirmed_lap': 1, 'race_code': RACE,
                                   'scanned_at': futuro}, self.kh())
        reg = await self.db.lap_registrations.find_one({'race_code': RACE, 'bib': '904', 'lap_number': 1})
        no_futuro = reg and reg['scan_time'].replace(tzinfo=timezone.utc) <= ahora() + timedelta(seconds=5)
        check('C9 hora futura se recorta al presente', s == 200 and no_futuro, d)

    async def bloque_confirm_tardia(self):
        print('\n== D. Confirmacion tardia y DNF automaticos ==')
        await self.reset(40)
        await self.reloj(70)                                    # ahora v2 m10
        # La vuelta 1 se escaneo en su minuto 38 (respecto a la salida vigente);
        # la confirmacion llega ya entrada la vuelta 2.
        salida = (await self.db.race_configurations.find_one({'code': RACE}))['started_at'].replace(tzinfo=timezone.utc)
        t_scan = (salida + timedelta(minutes=38)).isoformat()
        s, d = await self.confirm({'bib': '901', 'confirmed_lap': 1, 'race_code': RACE,
                                   'scanned_at': t_scan}, self.kh())
        check('D1 confirmar tarde respeta la hora del paso (no DNF)', s == 200 and d.get('action') == 'lap_completed', d)
        # DNF por tiempo: al 902 se le paso la vuelta 1
        s, d = await self.confirm({'bib': '902', 'confirmed_lap': 1, 'race_code': RACE}, self.kh())
        a = await self.atleta_db('902')
        check('D2 tiempo agotado -> DNF automatico', s == 200 and d.get('action') == 'auto_dnf' and a['status'] == 'retired', d)
        # Regreso temprano: el 901 (1 vuelta) vuelve en el minuto 10 de su vuelta 2
        s, d = await self.confirm({'bib': '901', 'confirmed_lap': 2, 'race_code': RACE}, self.kh())
        a = await self.atleta_db('901')
        check('D3 regreso temprano -> DNF, conserva su vuelta',
              s == 200 and d.get('action') == 'dnf_early_return' and a['status'] == 'retired' and a['laps_completed'] == 1, d)
        # Vuelta aun no iniciada: 904 completa v1... primero darsela valida
        await self.reloj(40)   # de vuelta a v1 m40
        await self.confirm({'bib': '904', 'confirmed_lap': 1, 'race_code': RACE}, self.kh())
        s, d = await self.confirm({'bib': '904', 'confirmed_lap': 2, 'race_code': RACE}, self.kh())
        check('D4 vuelta no iniciada -> se rechaza sin DNF', s == 200 and d.get('action') == 'lap_not_started', d)
        a = await self.atleta_db('904')
        check('D5 el rechazo no toca el contador', a['laps_completed'] == 1 and a['status'] == 'active', a)

    async def bloque_sync(self):
        print('\n== E. Sincronizacion fuera de linea ==')
        await self.reset(165)  # salida hace 165 min: vamos por v3 m45
        salida = (await self.db.race_configurations.find_one({'code': RACE}))['started_at'].replace(tzinfo=timezone.utc)
        t = lambda m: (salida + timedelta(minutes=m)).isoformat()

        lote = [  # desordenado a proposito: v3, v1, v2
            {'bib': '901', 'lap_number': 3, 'action': 'lap_completed', 'scanned_at': t(160), 'scanned_by': 'suite'},
            {'bib': '901', 'lap_number': 1, 'action': 'lap_completed', 'scanned_at': t(40), 'scanned_by': 'suite'},
            {'bib': '901', 'lap_number': 2, 'action': 'lap_completed', 'scanned_at': t(100), 'scanned_by': 'suite'},
        ]
        s, d = await self.sync(lote, self.kh())
        oks = [r['status'] for r in d.get('results', [])]
        a = await self.atleta_db('901')
        check('E1 lote desordenado se aplica en orden (3 vueltas)', s == 200 and oks == ['ok', 'ok', 'ok'] and a['laps_completed'] == 3, (oks, a.get('laps_completed')))
        reg = await self.db.lap_registrations.find_one({'race_code': RACE, 'bib': '901', 'lap_number': 2})
        delta = abs((reg['scan_time'].replace(tzinfo=timezone.utc) - (salida + timedelta(minutes=100))).total_seconds())
        check('E2 cada vuelta con su hora original', delta < 2, delta)
        s, d = await self.sync(lote, self.kh())
        oks = [r['status'] for r in d.get('results', [])]
        check('E3 reenviar el lote es inocuo (already_registered)', oks == ['already_registered'] * 3, oks)
        s, d = await self.sync([{'bib': '902', 'lap_number': 2, 'action': 'lap_completed',
                                 'scanned_at': t(100), 'scanned_by': 'suite'}], self.kh())
        check('E4 salto de vuelta -> conflicto (no se aplica)', d['results'][0]['status'] == 'conflicto', d)
        a = await self.atleta_db('902')
        check('E5 el conflicto no toca el contador', a['laps_completed'] == 0, a['laps_completed'])
        s, d = await self.sync([{'bib': '902', 'lap_number': 1, 'action': 'lap_completed',
                                 'scanned_at': t(10), 'scanned_by': 'suite'}], self.kh())
        a = await self.atleta_db('902')
        check('E6 hora en minuto 10 -> DNF por regreso temprano', d['results'][0]['status'] == 'dnf' and a['status'] == 'retired', d)
        s, d = await self.sync([{'bib': '903', 'lap_number': 1, 'action': 'lap_completed',
                                 'scanned_at': t(130), 'scanned_by': 'suite'}], self.kh())
        check('E7 hora fuera de su vuelta -> DNF por tiempo', d['results'][0]['status'] == 'dnf', d)
        s, d = await self.sync([{'bib': '904', 'lap_number': 1, 'action': 'dnf',
                                 'scanned_at': t(50), 'scanned_by': 'suite'}], self.kh())
        a = await self.atleta_db('904')
        check('E8 DNF manual fuera de linea', d['results'][0]['status'] == 'dnf' and a['status'] == 'retired', d)
        s, d = await self.sync([{'bib': '904', 'lap_number': 1, 'action': 'dnf',
                                 'scanned_at': t(55), 'scanned_by': 'suite'}], self.kh())
        check('E9 DNF repetido -> already_registered', d['results'][0]['status'] == 'already_registered', d)
        s, d = await self.sync([{'bib': '777', 'lap_number': 1, 'action': 'lap_completed',
                                 'scanned_at': t(40)}], self.kh())
        check('E10 dorsal desconocido -> conflicto', d['results'][0]['status'] == 'conflicto', d)
        s, d = await self.sync([{'bib': '901', 'lap_number': 4, 'action': 'volar',
                                 'scanned_at': t(40)}], self.kh())
        check('E11 accion desconocida -> conflicto', d['results'][0]['status'] == 'conflicto', d)
        s, d = await self.sync([{'bib': '901', 'lap_number': 4, 'action': 'lap_completed',
                                 'scanned_at': (salida - timedelta(minutes=30)).isoformat()}], self.kh())
        check('E12 hora anterior a la salida -> conflicto', d['results'][0]['status'] == 'conflicto', d)
        s, d = await self.sync([], self.kh())
        check('E13 lote vacio no rompe nada', s == 200 and d.get('results') == [], (s, d))
        futuro = (ahora() + timedelta(hours=2)).isoformat()
        s, d = await self.sync([{'bib': '901', 'lap_number': 4, 'action': 'lap_completed',
                                 'scanned_at': futuro}], self.kh())
        reg = await self.db.lap_registrations.find_one(
            {'race_code': RACE, 'bib': '901', 'lap_number': 4, 'anulada': {'$ne': True}})
        sin_futuro = (reg is None) or reg['scan_time'].replace(tzinfo=timezone.utc) <= ahora() + timedelta(seconds=5)
        check('E14 hora futura recortada: nada queda anotado en el futuro', sin_futuro, d)

    async def bloque_integridad(self):
        print('\n== F. Integridad del libro mayor ==')
        await self.reset(100)  # v2 m40
        salida = (await self.db.race_configurations.find_one({'code': RACE}))['started_at'].replace(tzinfo=timezone.utc)
        t = lambda m: (salida + timedelta(minutes=m)).isoformat()
        await self.sync([
            {'bib': '901', 'lap_number': 1, 'action': 'lap_completed', 'scanned_at': t(40)},
            {'bib': '901', 'lap_number': 2, 'action': 'lap_completed', 'scanned_at': t(99)},
        ], self.kh())
        libro = await self.db.lap_registrations.count_documents(
            {'race_code': RACE, 'bib': '901', 'action': 'lap_completed', 'anulada': {'$ne': True}})
        a = await self.atleta_db('901')
        check('F1 contador == vueltas vigentes del libro', a['laps_completed'] == libro == 2, (a['laps_completed'], libro))
        # cerrar la carrera congela el reloj
        await self.db.race_configurations.update_one(
            {'code': RACE}, {'$set': {'estado': 'cerrada', 'finished_at': ahora()}})
        r1 = await self.http.get(f'{API}/api/qr-scan/race-status?race_code={RACE}')
        await asyncio.sleep(2)
        r2 = await self.http.get(f'{API}/api/qr-scan/race-status?race_code={RACE}')
        check('F2 carrera cerrada: reloj congelado', r1.json()['current_lap'] == r2.json()['current_lap']
              and r2.json()['seconds_remaining'] == 0, r2.json()['current_lap'])
        # un escaneo con hora valida (antes del cierre) aun sincroniza
        s, d = await self.sync([{'bib': '902', 'lap_number': 1, 'action': 'lap_completed',
                                 'scanned_at': t(45)}], self.kh())
        check('F3 tras el cierre, un escaneo previo al cierre aun entra', d['results'][0]['status'] == 'ok', d)

    async def run(self):
        await self.preparar()
        await self.bloque_seguridad()
        await self.bloque_estados()
        await self.bloque_confirm()
        await self.bloque_confirm_tardia()
        await self.bloque_sync()
        await self.bloque_integridad()
        await self.http.aclose()

        fallos = [r for r in resultados if not r[1]]
        print(f'\n===== {len(resultados)} pruebas · {len(resultados) - len(fallos)} PASS · {len(fallos)} FAIL =====')
        for n, _, det in fallos:
            print('FALLO:', n, '·', det)
        return 1 if fallos else 0


sys.exit(asyncio.run(Suite().run()))
