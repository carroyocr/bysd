using Toybox.System as Sys;
using Toybox.Graphics as Gfx;

// Como se escriben los numeros en la esfera.
//
// Aqui vive la unica decision de unidades de toda la app: el reloj dice si su
// dueno quiere metrico o imperial y el resto obedece. Un corredor de Tennessee
// espera ver millas aunque tenga el reloj en espanol, porque las unidades no
// son idioma: son un ajuste aparte.
module Fmt {

    const KM_POR_MILLA = 0.621371;

    function esMetrico() {
        return Sys.getDeviceSettings().distanceUnits == Sys.UNIT_METRIC;
    }

    function unidad() {
        return esMetrico() ? "km" : "mi";
    }

    // 2832 -> "47:12".  -160 -> "-2:40".
    function reloj(segundos) {
        if (segundos == null) { return "--:--"; }
        var s = segundos.toNumber();
        var signo = "";
        if (s < 0) {
            signo = "-";
            s = -s;
        }
        var m = s / 60;
        var r = s % 60;
        return signo + m.format("%d") + ":" + r.format("%02d");
    }

    // Un dia. Por encima de esto la cuenta atras deja de ser un dato util.
    const UN_DIA = 86400;

    // La espera hasta la salida no es una vuelta: puede ser de meses. Con la
    // carrera abierta a inscripcion el servidor manda casi catorce millones de
    // segundos, y reloj() los escribiria como "230935:53" — nueve cifras que en
    // una esfera de 416 px miden 462 y se recortan por los dos lados.
    //
    // Por encima de una hora se cuenta en horas y minutos, que nunca pasa de
    // cinco caracteres.
    function espera(segundos) {
        if (segundos == null) { return "--:--"; }
        var s = segundos.toNumber();
        if (s < 3600) { return reloj(s); }
        var h = s / 3600;
        var m = (s % 3600) / 60;
        return h.format("%d") + ":" + m.format("%02d");
    }

    // Y por encima de un dia no se cuenta nada: a esa distancia el corredor no
    // quiere un cronometro, quiere saber que todavia no es hoy.
    function esperaLarga(segundos) {
        return segundos != null && segundos >= UN_DIA;
    }

    // El margen siempre lleva signo: un "+" delante es la diferencia entre
    // "descansas once minutos" y "llegas once minutos tarde".
    function margen(segundos) {
        if (segundos == null) { return "--:--"; }
        var s = segundos.toNumber();
        return (s >= 0 ? "+" : "") + reloj(s);
    }

    // El semaforo del corral, compartido por la app y el campo de datos: la
    // cuenta atras se tine de amarillo a los 3 minutos, naranja a los 2 y
    // rojo en el ultimo. Fuera del corral devuelve null y cada pantalla usa
    // sus colores de siempre.
    function colorCorral(restante) {
        if (restante == null || restante > RaceState.AVISOS_CORRAL[0]) {
            return null;
        }
        if (restante > RaceState.AVISOS_CORRAL[1]) { return Gfx.COLOR_YELLOW; }
        if (restante > RaceState.AVISOS_CORRAL[2]) { return Gfx.COLOR_ORANGE; }
        return Gfx.COLOR_RED;
    }

    function distancia(km) {
        if (km == null) { return "--"; }
        var d = esMetrico() ? km : km * KM_POR_MILLA;
        return d.format("%.1f");
    }

    // Segundos por kilometro -> "7:15" por km, o por milla si toca.
    function ritmo(segPorKm) {
        if (segPorKm == null || segPorKm <= 0 || segPorKm > 3600) { return "--:--"; }
        var s = esMetrico() ? segPorKm : segPorKm / KM_POR_MILLA;
        return reloj(s.toNumber());
    }
}
