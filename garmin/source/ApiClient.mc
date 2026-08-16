using Toybox.Communications as Comm;
using Toybox.Lang as Lang;
using Toybox.Time as Time;

// La unica pieza que sale a la red.
//
// El reloj no tiene internet propio: sale por Bluetooth a traves del telefono.
// En una backyard eso basta de sobra, porque el corredor pasa por meta cada
// hora y ahi se cruza con su telefono aunque lo haya dejado en la carpa. Entre
// vuelta y vuelta manda el cronometro local, no esta clase.
//
// Se piden dos cosas, en cadena y no a la vez: primero el estado de la vuelta,
// que es lo que no puede faltar, y solo si eso sale bien, el recuento de
// quienes siguen en pie.
class ApiClient {

    static const BASE = "https://bysd-backend.onrender.com";

    var _estado;
    var _enVuelo = false;

    function initialize(estado) {
        _estado = estado;
    }

    function refrescar() {
        // Una peticion cada vez. Encadenar mas solo gasta bateria y radio.
        if (_enVuelo) { return; }
        _enVuelo = true;
        Comm.makeWebRequest(
            BASE + "/api/race/lap-status",
            _parametros(),
            _opciones(),
            method(:onLapStatus)
        );
    }

    function onLapStatus(codigo, datos) {
        if (codigo != 200 || datos == null) {
            _enVuelo = false;
            return;
        }

        // Estos dos todavia no viajan en lap-status; hoy solo salen en /live,
        // que es del panel. En cuanto el backend los publique, la app deja de
        // usar sus valores por defecto sin tocar una linea.
        var minutos = _numero(datos["minutos_por_vuelta"]);
        if (minutos != null && minutos > 0) {
            _estado.duracionVuelta = minutos.toNumber() * 60;
        }
        var km = _numero(datos["km_por_vuelta"]);
        if (km != null && km > 0) {
            _estado.kmPorVuelta = km.toFloat();
        }

        _estado.sembrar(
            _entero(datos["current_lap"], 0),
            _entero(datos["seconds_remaining"], 0),
            _booleano(datos["race_started"], false),
            _booleano(datos["race_finished"], false)
        );

        Comm.makeWebRequest(
            BASE + "/api/race/stats",
            _parametros(),
            _opciones(),
            method(:onStats)
        );
    }

    function onStats(codigo, datos) {
        _enVuelo = false;
        if (codigo != 200 || datos == null) { return; }

        var activos = _entero(datos["athletes_active"], 0);
        var retirados = _entero(datos["athletes_dnf"], 0);
        var noSalieron = _entero(datos["athletes_dns"], 0);

        _estado.enCarrera = activos;
        _estado.inscritos = activos + retirados + noSalieron;
    }

    function _parametros() {
        var p = {};
        // Sin codigo, el backend responde por la carrera que el sitio tenga
        // publicada. Es lo que quiere el corredor que no configuro nada.
        if (_estado.raceCode != null) {
            p["race_code"] = _estado.raceCode;
        }
        return p;
    }

    function _opciones() {
        return {
            :method => Comm.HTTP_REQUEST_METHOD_GET,
            :headers => {
                "Content-Type" => Comm.REQUEST_CONTENT_TYPE_URL_ENCODED
            },
            :responseType => Comm.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
    }

    // El JSON llega tal cual lo mando el servidor: puede faltar una clave o
    // venir con otro tipo. Mejor un valor por defecto que una excepcion a las
    // veinte horas de carrera.

    function _numero(v) {
        if (v == null) { return null; }
        if (v instanceof Lang.Number || v instanceof Lang.Float) { return v; }
        return null;
    }

    function _entero(v, porDefecto) {
        var n = _numero(v);
        return n == null ? porDefecto : n.toNumber();
    }

    function _booleano(v, porDefecto) {
        if (v instanceof Lang.Boolean) { return v; }
        return porDefecto;
    }
}
