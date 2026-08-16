using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Timer as Timer;

// El emblema, a pantalla completa, poco mas de un segundo.
//
// El logo de la carrera ya es un circulo sobre fondo negro, asi que entra en
// la esfera sin recortar nada. De aqui se pasa directo a la vuelta: no hay
// pantalla intermedia ni nombre de carrera. En la vuelta uno el emblema
// emociona; en la vuelta veinte estorba, y por eso cualquier boton lo salta.
class SplashView extends Ui.View {

    static const MILISEGUNDOS = 1200;

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
        if (_emblema != null) {
            dc.drawBitmap(
                (dc.getWidth() - _emblema.getWidth()) / 2,
                (dc.getHeight() - _emblema.getHeight()) / 2,
                _emblema
            );
        }
    }

    function salir() {
        if (_yaSalio) { return; }
        _yaSalio = true;
        SplashView.irALaVuelta(_estado);
    }

    // Compartido con el delegado: los dos caminos, el del reloj y el del
    // boton, tienen que acabar en la misma vista.
    static function irALaVuelta(estado) {
        var vista = new MainView(estado);
        Ui.switchToView(vista, new MainDelegate(vista), Ui.SLIDE_IMMEDIATE);
    }
}

class SplashDelegate extends Ui.BehaviorDelegate {

    var _estado;

    function initialize(estado) {
        BehaviorDelegate.initialize();
        _estado = estado;
    }

    function onSelect() {
        SplashView.irALaVuelta(_estado);
        return true;
    }

    function onNextPage() {
        SplashView.irALaVuelta(_estado);
        return true;
    }

    // onBack se deja sin tocar a proposito: si alguien quiere salir de la app
    // durante el segundo del emblema, que pueda salir.
}
