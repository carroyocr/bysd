using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Position as Position;
using Toybox.Application as App;

// La linea de salida.
//
// Es lo que se ve entre abrir la app y pulsar START: que vuelta se va a correr
// y si el GPS ya fijo. Nada mas, porque en la linea de salida nadie configura
// nada; eso se hizo desde el telefono en la carpa.
class StartView extends Ui.View {

    var _estado;
    var _s as Toybox.Lang.Dictionary = {};

    function initialize(estado) {
        View.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        _s = {
            :lap => Ui.loadResource(Rez.Strings.lap),
            :pressStart => Ui.loadResource(Rez.Strings.pressStart),
            :gpsReady => Ui.loadResource(Rez.Strings.gpsReady),
            :gpsWait => Ui.loadResource(Rez.Strings.gpsWait)
        };
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;

        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();

        // La vuelta que se va a correr, en la unidad del reloj y con los
        // minutos que dura. Si esta mal, es ahora cuando hay que verlo.
        _txt(dc, cx, cy - (h * 31 / 100), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             _s[:lap] + " 1");
        _txt(dc, cx, cy - (h * 22 / 100), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             Fmt.distancia(_estado.kmPorVuelta) + " " + Fmt.unidad() + " / "
             + (_estado.duracionVuelta / 60).format("%d") + " min");

        _txt(dc, cx, cy, Gfx.FONT_MEDIUM, Gfx.COLOR_WHITE, _s[:pressStart]);

        // El estado del GPS decide si ya se puede salir con la conciencia
        // tranquila. Verde: fijo. Gris: todavia buscando.
        var listo = _gpsListo();
        _txt(dc, cx, cy + (h * 20 / 100), Gfx.FONT_XTINY,
             listo ? Gfx.COLOR_GREEN : Gfx.COLOR_DK_GRAY,
             listo ? _s[:gpsReady] : _s[:gpsWait]);
    }

    function _gpsListo() {
        var info = Position.getInfo();
        return info != null && info.accuracy != null
            && info.accuracy >= Position.QUALITY_USABLE;
    }

    function _txt(dc, x, y, fuente, color, texto) {
        if (texto == null) { return; }
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(x, y, fuente, texto,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }
}

class StartDelegate extends Ui.BehaviorDelegate {

    var _estado;

    function initialize(estado) {
        BehaviorDelegate.initialize();
        _estado = estado;
    }

    // START es la campana. No hay confirmacion: en la linea de salida, con la
    // cuenta atras del director de carrera sonando, un dialogo estorba.
    function onSelect() {
        var app = App.getApp();
        if (app != null) {
            app.darLaSalida();
        }
        var vista = new MainView(_estado);
        Ui.switchToView(vista, new MainDelegate(vista, _estado), Ui.SLIDE_IMMEDIATE);
        return true;
    }

    // onBack se deja sin tocar: antes de la salida, salir de la app es salir
    // de la app.
}
