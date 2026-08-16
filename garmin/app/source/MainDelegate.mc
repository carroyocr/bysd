using Toybox.WatchUi as Ui;
using Toybox.Application as App;

// Botones y gestos.
//
// Arriba y abajo cambian de pantalla; el boton de accion fuerza una consulta
// al servidor, que es lo que uno quiere pulsar justo despues de pasar por meta.
class MainDelegate extends Ui.BehaviorDelegate {

    var _vista;

    function initialize(vista) {
        BehaviorDelegate.initialize();
        _vista = vista;
    }

    function onNextPage() {
        _vista.avanzar(1);
        Ui.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        _vista.avanzar(-1);
        Ui.requestUpdate();
        return true;
    }

    function onSelect() {
        var app = App.getApp();
        if (app != null && app.latido != null) {
            app.latido.refrescar();
        }
        return true;
    }

    // En los relojes tactiles el gesto hace lo mismo que los botones: quien
    // corre con guantes usa los botones, quien no, desliza.
    function onSwipe(evento) {
        var direccion = evento.getDirection();
        if (direccion == Ui.SWIPE_UP) {
            return onNextPage();
        }
        if (direccion == Ui.SWIPE_DOWN) {
            return onPreviousPage();
        }
        return false;
    }
}
