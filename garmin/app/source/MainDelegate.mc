using Toybox.WatchUi as Ui;

// Botones y gestos.
//
// Arriba y abajo cambian de pantalla. El boton de accion vuelve a poner el cero
// de la carrera en este instante: es para quien arranco la actividad unos
// minutos antes de que sonara la campana. Va con confirmacion porque un toque
// sin querer a la vuelta veinte descuadraria toda la cuenta.
class MainDelegate extends Ui.BehaviorDelegate {

    var _vista;
    var _estado;

    function initialize(vista, estado) {
        BehaviorDelegate.initialize();
        _vista = vista;
        _estado = estado;
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
        if (!_estado.empezada()) { return true; }
        var texto = Ui.loadResource(Rez.Strings.startNow);
        Ui.pushView(new Ui.Confirmation(texto),
                    new SalidaDelegate(_estado),
                    Ui.SLIDE_IMMEDIATE);
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

class SalidaDelegate extends Ui.ConfirmationDelegate {

    var _estado;

    function initialize(estado) {
        ConfirmationDelegate.initialize();
        _estado = estado;
    }

    function onResponse(respuesta) {
        if (respuesta == Ui.CONFIRM_YES) {
            _estado.darLaSalida();
            Ui.requestUpdate();
        }
        return true;
    }
}
