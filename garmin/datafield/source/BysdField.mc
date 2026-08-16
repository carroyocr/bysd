using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;

// El campo de datos, dentro de la actividad.
//
// Aqui esta el margen, porque aqui es donde hay distancia y ritmo: la app de
// reloj no puede leer la actividad de otro. Y aqui es donde el corredor ya
// esta mirando, que vale mas que cualquier pantalla que haya que ir a buscar.
//
// El tamano lo decide el corredor al montar su pantalla de actividad: puede
// caer en una banda estrecha de tres campos o quedarse con la pantalla entera.
// Por eso no hay medidas fijas: se mide el hueco y se elige el reparto.
class BysdField extends Ui.DataField {

    // Altura minima, en pixeles, para que quepa cada reparto.
    static const ALTO_TRES_LINEAS = 90;
    static const ALTO_DOS_LINEAS = 52;

    var _estado;
    var _api;
    var _latido;
    var _s;

    function initialize() {
        DataField.initialize();
        _estado = new RaceState();
        _api = new ApiClient(_estado);
        _latido = new Latido(_estado, _api);
    }

    function releerAjustes() {
        _estado.leerAjustes();
        _latido.refrescar();
    }

    function onLayout(dc) {
        _s = {
            :lap => Ui.loadResource(Rez.Strings.lap),
            :nextStart => Ui.loadResource(Rez.Strings.nextStart),
            :corral => Ui.loadResource(Rez.Strings.corral),
            :rest => Ui.loadResource(Rez.Strings.rest),
            :paceTooSlow => Ui.loadResource(Rez.Strings.paceTooSlow),
            :notStarted => Ui.loadResource(Rez.Strings.notStarted),
            :raceClosed => Ui.loadResource(Rez.Strings.raceClosed),
            :syncing => Ui.loadResource(Rez.Strings.syncing)
        };
    }

    // El sistema la llama una vez por segundo con la actividad ya servida. No
    // hace falta temporizador propio: este es el latido.
    function compute(info) {
        _estado.infoActividad = info;
        _latido.tic();
    }

    function onUpdate(dc) {
        // El campo se dibuja dentro de la pantalla de actividad y hereda su
        // tema. Pintar negro a la fuerza dejaria un parche en un reloj con el
        // fondo claro.
        var fondo = getBackgroundColor();
        var tinta = (fondo == Gfx.COLOR_BLACK) ? Gfx.COLOR_WHITE : Gfx.COLOR_BLACK;
        var verde = (fondo == Gfx.COLOR_BLACK) ? Gfx.COLOR_GREEN : Gfx.COLOR_DK_GREEN;

        dc.setColor(fondo, fondo);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();

        if (!_estado.sincronizado) {
            _centrado(dc, w, h, tinta, _s[:syncing]);
            return;
        }
        if (_estado.terminada) {
            _centrado(dc, w, h, tinta, _s[:raceClosed]);
            return;
        }
        if (!_estado.empezada) {
            var previo = _estado.restante();
            _centrado(dc, w, h, tinta,
                      previo != null && previo > 0 ? Fmt.reloj(previo) : _s[:notStarted]);
            return;
        }

        var restante = _estado.restante();
        var margen = _estado.margenSegundos();
        var corral = _estado.enCorral();
        var vaSobrado = (margen != null && margen >= 0);

        var colorCuenta = corral ? Gfx.COLOR_RED : tinta;
        var colorMargen = (margen == null) ? tinta : (vaSobrado ? verde : Gfx.COLOR_RED);

        if (h >= ALTO_TRES_LINEAS) {
            _tresLineas(dc, w, h, tinta, colorCuenta, colorMargen,
                        restante, margen, corral, vaSobrado);
        } else if (h >= ALTO_DOS_LINEAS) {
            _dosLineas(dc, w, h, colorCuenta, colorMargen, restante, margen);
        } else {
            _unaLinea(dc, w, h, colorCuenta, colorMargen, restante, margen);
        }
    }

    // --- repartos ---

    // Pantalla entera o campo grande: etiqueta, cuenta atras y margen.
    function _tresLineas(dc, w, h, tinta, colorCuenta, colorMargen,
                         restante, margen, corral, vaSobrado) {
        var etiqueta = corral
            ? _s[:corral]
            : _s[:lap] + " " + _estado.vuelta().format("%d");
        _texto(dc, w / 2, h * 16 / 100, Gfx.FONT_XTINY, tinta, etiqueta);

        var fuente = _fuenteQueCabe(dc, h * 45 / 100);
        _texto(dc, w / 2, h / 2, fuente, colorCuenta, Fmt.reloj(restante));

        var pie = (margen == null)
            ? Fmt.distancia(_estado.kmEnLaVuelta()) + " " + Fmt.unidad()
            : Fmt.margen(margen) + "  " + (vaSobrado ? _s[:rest] : _s[:paceTooSlow]);
        _texto(dc, w / 2, h * 84 / 100, Gfx.FONT_XTINY, colorMargen, pie);
    }

    // Media pantalla: la cuenta atras manda, el margen debajo y pequeno.
    function _dosLineas(dc, w, h, colorCuenta, colorMargen, restante, margen) {
        var fuente = _fuenteQueCabe(dc, h * 55 / 100);
        _texto(dc, w / 2, h * 36 / 100, fuente, colorCuenta, Fmt.reloj(restante));
        _texto(dc, w / 2, h * 82 / 100, Gfx.FONT_XTINY, colorMargen, Fmt.margen(margen));
    }

    // Banda estrecha: las dos cifras y nada mas. La cuenta atras a la
    // izquierda porque es la que se mira sin pensar.
    function _unaLinea(dc, w, h, colorCuenta, colorMargen, restante, margen) {
        var fuente = _fuenteQueCabe(dc, h * 80 / 100);
        dc.setColor(colorCuenta, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w * 6 / 100, h / 2, fuente, Fmt.reloj(restante),
                    Gfx.TEXT_JUSTIFY_LEFT | Gfx.TEXT_JUSTIFY_VCENTER);
        dc.setColor(colorMargen, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w * 94 / 100, h / 2, fuente, Fmt.margen(margen),
                    Gfx.TEXT_JUSTIFY_RIGHT | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    // --- piezas ---

    function _centrado(dc, w, h, color, texto) {
        _texto(dc, w / 2, h / 2, Gfx.FONT_XTINY, color, texto);
    }

    function _texto(dc, x, y, fuente, color, texto) {
        if (texto == null) { return; }
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(x, y, fuente, texto,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    // La fuente mas grande que quepa en el alto disponible. Un campo de datos
    // no sabe de antemano cuanto sitio le van a dar, y una cifra recortada por
    // arriba no se lee.
    function _fuenteQueCabe(dc, alto) {
        var candidatas = [
            Gfx.FONT_NUMBER_MEDIUM,
            Gfx.FONT_NUMBER_MILD,
            Gfx.FONT_LARGE,
            Gfx.FONT_MEDIUM,
            Gfx.FONT_SMALL,
            Gfx.FONT_XTINY
        ];
        for (var i = 0; i < candidatas.size(); i++) {
            if (dc.getFontHeight(candidatas[i]) <= alto) {
                return candidatas[i];
            }
        }
        return Gfx.FONT_XTINY;
    }
}
