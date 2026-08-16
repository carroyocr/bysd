using Toybox.System as Sys;

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

    // El margen siempre lleva signo: un "+" delante es la diferencia entre
    // "descansas once minutos" y "llegas once minutos tarde".
    function margen(segundos) {
        if (segundos == null) { return "--:--"; }
        var s = segundos.toNumber();
        return (s >= 0 ? "+" : "") + reloj(s);
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
