using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Timer as Timer;
using Toybox.Application as App;

// El emblema, a pantalla completa, cinco segundos.
//
// El logo ya es un circulo sobre fondo negro, asi que entra en la esfera sin
// recortar nada. De aqui se pasa directo a la vuelta: no hay pantalla
// intermedia ni nombre de carrera. En la vuelta uno el emblema emociona; en la
// vuelta veinte estorba, y por eso cualquier boton lo salta: los cinco
// segundos son el maximo, no una espera obligada.
class SplashView extends Ui.View {

    static const MILISEGUNDOS = 5000;

    var _estado;
    var _timer;
    var _emblema;
    var _yaSalio = false;

    function initialize(estado) {
        View.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        _emblema = Ui.loadResource(Rez.Drawables.Emblema);
    }

    function onShow() {
        _timer = new Timer.Timer();
        _timer.start(method(:salir), MILISEGUNDOS, false);
    }

    function onHide() {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        // Son unos 20 KB de mapa de bits. En un reloj eso es dinero, y a
        // partir de aqui no se vuelve a dibujar.
        _emblema = null;
    }

    function onUpdate(dc) {
        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();
        if (_emblema == null) { return; }

        var w = dc.getWidth();
        var h = dc.getHeight();
        var ancho = _emblema.getWidth();
        var alto = _emblema.getHeight();

        // El monkey.jungle reparte un emblema por tamano de pantalla, pero esa
        // cuenta se puede quedar corta con un reloj que todavia no existe. Si
        // el emblema no cabe se encoge, porque recortarlo no se ve como un
        // fallo: se ve como un logo mal hecho, y nadie lo reporta.
        if ((ancho > w || alto > h) && (dc has :drawScaledBitmap)) {
            var lado = (w < h ? w : h);
            dc.drawScaledBitmap((w - lado) / 2, (h - lado) / 2, lado, lado, _emblema);
            return;
        }

        dc.drawBitmap((w - ancho) / 2, (h - alto) / 2, _emblema);
    }

    // 'as Void' por lo mismo que en BackyardApp: lo pide Timer.start.
    function salir() as Void {
        if (_yaSalio) { return; }
        _yaSalio = true;
        SplashView.irALaSalida(_estado);
    }

    // Compartido con el delegado: los dos caminos, el del reloj y el del
    // boton, tienen que acabar en la misma vista. Si quedo una carrera viva de
    // una sesion anterior -la app se cerro a mitad-, se ofrece reanudarla
    // antes de la linea de salida.
    //
    // La pregunta es un Menu2 propio y no un Ui.Confirmation, por lo mismo
    // que el menu de terminar: al dialogo nativo lo cierra el sistema con un
    // popView por su cuenta, y cambiar de vista al responder era una carrera
    // de tiempos que en el fenix 8 dejaba el dialogo fantasma dibujandose
    // sobre lo que viniera despues (se veia tras cada actualizacion de la
    // app, que es cuando queda carrera guardada de la prueba anterior).
    static function irALaSalida(estado) {
        if (estado.hayGuardada()) {
            var menu = new Ui.Menu2({ :title => Rez.Strings.resumeRace });
            menu.addItem(new Ui.MenuItem(Rez.Strings.resume, null, :si, null));
            menu.addItem(new Ui.MenuItem(Rez.Strings.resumeNew, null, :no, null));
            Ui.pushView(menu, new ReanudarDelegate(estado), Ui.SLIDE_IMMEDIATE);
        } else {
            Ui.switchToView(new StartView(estado), new StartDelegate(estado),
                            Ui.SLIDE_IMMEDIATE);
        }
    }
}

// La pregunta de reanudar, al abrir con una carrera guardada. Reanudar:
// restaura el estado y sigue la carrera donde estaba. Carrera nueva: descarta
// la guardada y va a la linea de salida. No hay tercera salida: BACK no hace
// nada, porque debajo solo queda el emblema y la decision hay que tomarla.
class ReanudarDelegate extends Ui.Menu2InputDelegate {

    var _estado;

    function initialize(estado) {
        Menu2InputDelegate.initialize();
        _estado = estado;
    }

    function onSelect(item) {
        if (item.getId() == :si) {
            _estado.recuperar();
            var app = App.getApp();
            if (app != null) { app.reanudar(); }
            var vista = new MainView(_estado);
            Ui.switchToView(vista, new MainDelegate(vista, _estado),
                            Ui.SLIDE_IMMEDIATE);
        } else {
            _estado.limpiar();
            Ui.switchToView(new StartView(_estado), new StartDelegate(_estado),
                            Ui.SLIDE_IMMEDIATE);
        }
    }

    function onBack() {
    }
}

class SplashDelegate extends Ui.BehaviorDelegate {

    var _estado;

    function initialize(estado) {
        BehaviorDelegate.initialize();
        _estado = estado;
    }

    function onSelect() {
        SplashView.irALaSalida(_estado);
        return true;
    }

    function onNextPage() {
        SplashView.irALaSalida(_estado);
        return true;
    }

    // START y las flechas saltan el emblema a la linea de salida; BACK, en
    // cambio, sale de la app: antes de dar la salida no se graba nada, asi que
    // el BACK de siempre -volver a la lista de actividades- es lo correcto.
    // Devolver false deja que el sistema lo haga.
    function onBack() {
        return false;
    }
}
