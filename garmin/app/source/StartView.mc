using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Position as Position;
using Toybox.Application as App;
using Toybox.Time as Time;
using Toybox.Lang as Lang;

// La linea de salida.
//
// Es lo que se ve entre fijar la hora de salida y pulsar START: a que hora
// suena la campana y cuanto falta, que vuelta se va a correr, como esta
// configurada la actividad y si el GPS ya fijo. Si esta mal, es ahora cuando
// hay que verlo.
//
// Pulsar START antes de la hora arranca la grabacion y la cuenta atras sigue
// en la pantalla de carrera (el calentamiento). Si nadie pulsa, la carrera
// arranca sola al llegar la hora: la campana no espera a nadie.
class StartView extends Ui.View {

    var _estado;
    var _s as Lang.Dictionary = {};

    // Si la campana se vio todavia por delante. Solo entonces vale arrancar
    // solo al llegar la hora: quien abre la app con la hora fija ya pasada
    // -llega tarde a su propia carrera- sale cuando pulse START, no de golpe.
    // Vive en la vista y no en onShow: si el corredor esta en el menu de
    // ajustes cuando llega la hora, al volver arranca igual, y el ancla sigue
    // siendo la hora, no el momento en que volvio.
    var _armada = false;

    // Las zonas tocables del ultimo dibujo: [x0, y0, x1, y1, que]. Los
    // ajustes de la configuracion se encienden y apagan con el dedo, y la
    // hora de salida vuelve a abrir su rueda.
    var _zonas as Lang.Array<Lang.Array> = [] as Lang.Array<Lang.Array>;

    function initialize(estado) {
        View.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        _s = {
            :titulo => Ui.loadResource(Rez.Strings.settingStartTime),
            :auto => Ui.loadResource(Rez.Strings.auto),
            :faltan => Ui.loadResource(Rez.Strings.startsIn),
            :enCurso => Ui.loadResource(Rez.Strings.underway),
            :pressStart => Ui.loadResource(Rez.Strings.pressStart),
            :meta => Ui.loadResource(Rez.Strings.cfgAutoFinish),
            :km => Ui.loadResource(Rez.Strings.cfgAutoKm),
            :vibra => Ui.loadResource(Rez.Strings.cfgVibe),
            :sonido => Ui.loadResource(Rez.Strings.settingSound),
            :gpsReady => Ui.loadResource(Rez.Strings.gpsReady),
            :gpsWait => Ui.loadResource(Rez.Strings.gpsWait)
        };
    }

    // El latido de la app llama aqui cada segundo mientras esta vista esta en
    // pantalla y no se graba nada.
    function onShow() {
        var app = App.getApp();
        if (app != null) { app.linea = self; }
    }

    function onHide() {
        var app = App.getApp();
        if (app != null && app.linea == self) { app.linea = null; }
    }

    // Arranca sola si la campana, que se vio por delante, ya llego.
    function revisarHora() {
        var falta = _estado.campanaPrevista() - Time.now().value();
        if (falta > 0) {
            _armada = true;
            return;
        }
        if (_armada) {
            StartDelegate.salir(_estado);
        }
    }

    // Un toque en la pantalla. Nunca da la salida: eso es solo el boton
    // START, para que un roce en la carpa no arranque la carrera.
    function tocar(x as Lang.Number, y as Lang.Number) {
        for (var i = 0; i < _zonas.size(); i++) {
            var z = _zonas[i] as Lang.Array;
            var x0 = z[0] as Lang.Number;
            var y0 = z[1] as Lang.Number;
            var x1 = z[2] as Lang.Number;
            var y1 = z[3] as Lang.Number;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
                _accion(z[4]);
                return;
            }
        }
    }

    function _accion(que) {
        if (que == :hora) {
            SalidaInicialDelegate.abrir(_estado);
            return;
        }
        // Las mismas propiedades que escriben el menu de ajustes y el
        // telefono. El LAP se guarda al reves: el ajuste es "LAP apagado".
        var clave = que == :meta ? "autoLap"
                  : que == :km ? "autoLapKm"
                  : que == :lap ? "lapOff"
                  : que == :vibra ? "vibration" : "sound";
        var actual = que == :meta ? _estado.autoLap
                   : que == :km ? _estado.autoLapKm
                   : que == :lap ? _estado.lapApagado
                   : que == :vibra ? _estado.vibracion : _estado.sonido;
        App.Properties.setValue(clave, !actual);
        _estado.leerAjustes();
        Ui.requestUpdate();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();

        var campana = _estado.campanaPrevista();
        var falta = campana - Time.now().value();
        var cuenta = falta > 0
                   ? _s[:faltan] + " " + Fmt.espera(falta)
                   : _s[:enCurso];
        if (_estado.horaSalida < 0) {
            cuenta = _s[:auto] + " · " + cuenta;
        }
        var hora = AjustesMenuDelegate.textoDeSalida(
            AjustesMenuDelegate.hhmmDe(campana));

        // Todo va apilado y centrado, con el alto real de cada fuente: en una
        // esfera de 218 px y en una de 454 las mismas proporciones no dejan
        // el mismo aire, y medido no se monta ninguna linea.
        var xt = Gfx.FONT_XTINY;
        var filas = [
            [ xt, Gfx.COLOR_LT_GRAY, [ _s[:titulo] ] ],
            [ Gfx.FONT_LARGE, Gfx.COLOR_WHITE, [ hora ], :hora ],
            [ xt, Gfx.COLOR_ORANGE, [ cuenta ] ],
            [ xt, Gfx.COLOR_LT_GRAY,
              [ Fmt.distancia(_estado.kmPorVuelta) + " " + Fmt.unidad() + " / "
                + (_estado.duracionVuelta / 60).format("%d") + " min" ] ],
            [ Gfx.FONT_SMALL, Gfx.COLOR_WHITE, [ _s[:pressStart] ] ],
            // La configuracion: verde lo que esta puesto, gris lo que no.
            [ xt, null, [ _s[:meta], _estado.autoLap, :meta,
                          _s[:km], _estado.autoLapKm, :km ] ],
            [ xt, null, [ "LAP", !_estado.lapApagado, :lap,
                          _s[:vibra], _estado.vibracion, :vibra,
                          _s[:sonido], _estado.sonido, :sonido ] ],
            [ xt, _gpsListo() ? Gfx.COLOR_GREEN : Gfx.COLOR_LT_GRAY,
              [ _gpsListo() ? _s[:gpsReady] : _s[:gpsWait] ] ]
        ];

        var total = 0;
        for (var i = 0; i < filas.size(); i++) {
            total += dc.getFontHeight(filas[i][0]);
        }
        var y = (h - total) / 2;
        _zonas = [];
        for (var i = 0; i < filas.size(); i++) {
            var fila = filas[i] as Lang.Array;
            var fuente = fila[0];
            var alto = dc.getFontHeight(fuente);
            var centro = y + (alto / 2);
            if (fila[1] == null) {
                _interruptores(dc, cx, centro, alto, fuente, fila[2]);
            } else {
                var texto = (fila[2] as Lang.Array)[0];
                _txt(dc, cx, centro, fuente, fila[1], texto);
                if (fila.size() > 3) {
                    var mitad = dc.getTextWidthInPixels(texto, fuente) / 2;
                    _zonas.add([ cx - mitad, y, cx + mitad, y + alto, fila[3] ]);
                }
            }
            y += alto;
        }
    }

    // Una fila de ajustes encendidos o apagados: trios de texto, estado y
    // accion, repartidos a lo ancho con un hueco entre ellos. Cada uno deja
    // su zona tocable, ensanchada hasta la mitad del hueco para que el dedo
    // no tenga que acertar la letra.
    function _interruptores(dc, cx, cy, alto, fuente, trios) {
        var items = trios as Lang.Array;
        var hueco = dc.getTextWidthInPixels("  ", fuente);
        var ancho = 0;
        for (var i = 0; i < items.size(); i += 3) {
            if (i > 0) { ancho += hueco; }
            ancho += dc.getTextWidthInPixels(items[i], fuente);
        }
        var x = cx - (ancho / 2);
        for (var i = 0; i < items.size(); i += 3) {
            var largo = dc.getTextWidthInPixels(items[i], fuente);
            dc.setColor(items[i + 1] ? Gfx.COLOR_GREEN : Gfx.COLOR_LT_GRAY,
                        Gfx.COLOR_TRANSPARENT);
            dc.drawText(x, cy, fuente, items[i],
                        Gfx.TEXT_JUSTIFY_LEFT | Gfx.TEXT_JUSTIFY_VCENTER);
            _zonas.add([ x - (hueco / 2), cy - (alto / 2),
                         x + largo + (hueco / 2), cy + (alto / 2), items[i + 2] ]);
            x += largo + hueco;
        }
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

    var _vista;
    var _estado;

    function initialize(vista, estado) {
        BehaviorDelegate.initialize();
        _vista = vista;
        _estado = estado;
    }

    // El toque se consume siempre, toque algo o no: si se dejara pasar, el
    // sistema lo convertiria en onSelect y un roce daria la salida.
    function onTap(evento) {
        var xy = evento.getCoordinates();
        _vista.tocar(xy[0], xy[1]);
        return true;
    }

    // START es la campana. No hay confirmacion: en la linea de salida, con la
    // cuenta atras del director de carrera sonando, un dialogo estorba.
    function onSelect() {
        StartDelegate.salir(_estado);
        return true;
    }

    // Dar la salida y pasar a la carrera. Lo comparten START y el arranque
    // solo de la linea de salida al llegar la hora.
    static function salir(estado) {
        var app = App.getApp();
        if (app != null) {
            app.linea = null;
            app.darLaSalida();
        }
        var vista = new MainView(estado);
        Ui.switchToView(vista, new MainDelegate(vista, estado), Ui.SLIDE_IMMEDIATE);
    }

    // Antes de dar la salida no hay nada que proteger -no se graba nada-, asi
    // que BACK sale de la app como en cualquier actividad sin empezar. Devolver
    // false deja que el sistema haga el BACK de siempre: volver a la lista de
    // actividades.
    function onBack() {
        return false;
    }

    // El boton de menu (UP largo) abre los ajustes de la vuelta, para
    // fijarlos en el reloj sin sacar el telefono. Solo aqui y durante el
    // calentamiento: con la vuelta 1 ya abierta, cambiar la duracion
    // moveria las campanas. El menu lo arma AjustesMenuDelegate, que es el
    // mismo para los dos momentos.
    function onMenu() {
        AjustesMenuDelegate.abrir(_estado);
        return true;
    }

    // En el fenix 8 no hay boton de menu dedicado: el menu es UP largo, y en
    // el reloj real esa pulsacion no siempre llega como onMenu (en el
    // simulador si). Por eso el mismo menu se abre por tres caminos: el
    // comportamiento de menu, la tecla KEY_MENU cruda por si el firmware la
    // entrega asi, y el toque sostenido en la pantalla tactil.
    function onKey(evento) {
        if (evento.getKey() == Ui.KEY_MENU) { return onMenu(); }
        return false;
    }

    function onHold(evento) {
        return onMenu();
    }
}
