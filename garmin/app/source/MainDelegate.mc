using Toybox.WatchUi as Ui;
using Toybox.Application as App;

// Botones y gestos durante la carrera.
//
// Se respeta la costumbre de cualquier reloj Garmin de correr, que el corredor
// ya tiene en el dedo: arriba y abajo cambian de pantalla; el boton de abajo a
// la derecha -LAP- marca que la vuelta termino; el de arriba a la derecha
// -START/STOP- para y abre el menu de guardar. Abrir vuelta no lo hace ningun
// boton: lo hace la hora.
//
// En Connect IQ ese LAP llega como onBack y ese START como onSelect, asi que
// lo que aqui parece del reves es justo lo natural en la muneca.
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

    // START/STOP para y abre el menu de guardar, como en cualquier actividad
    // de Garmin. No sale de la app sin preguntar: debajo hay una actividad
    // grabando y una backyard no tiene segunda salida.
    function onSelect() {
        // Los rotulos van como id de recurso, sin loadResource: cargados a
        // mano en este contexto, el Menu2 del fenix 8 los dibujaba en blanco
        // (el menu salia vacio y parecia no hacer nada). Con el id, el menu
        // los resuelve el solo y se ve en los seis idiomas.
        var menu = new Ui.Menu2({ :title => Rez.Strings.endTitle });
        menu.addItem(new Ui.MenuItem(Rez.Strings.resume, null, :seguir, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.save, null, :guardar, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.discard, null, :descartar, null));
        Ui.pushView(menu, new MenuFinDelegate(), Ui.SLIDE_UP);
        return true;
    }

    // LAP marca que la vuelta termino y empieza el descanso; solo vale el
    // primero de cada vuelta, los demas se ignoran. La vuelta siguiente la
    // abre la hora, no este boton. Devolver true se traga el BACK: durante la
    // carrera no hay retroceso, la unica salida es el menu de START.
    function onBack() {
        var app = App.getApp();
        if (app != null) {
            app.marcarVuelta();
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

class MenuFinDelegate extends Ui.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :guardar) {
            var app = App.getApp();
            if (app != null) { app.terminar(true); }
        } else if (id == :descartar) {
            // Descartar treinta horas por un toque seria imperdonable: es la
            // unica opcion del menu que pide confirmacion.
            Ui.pushView(new Ui.Confirmation(Ui.loadResource(Rez.Strings.discardSure)),
                        new DescartarDelegate(), Ui.SLIDE_IMMEDIATE);
        } else {
            Ui.popView(Ui.SLIDE_DOWN);
        }
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
    }
}

class DescartarDelegate extends Ui.ConfirmationDelegate {

    function initialize() {
        ConfirmationDelegate.initialize();
    }

    function onResponse(respuesta) {
        if (respuesta == Ui.CONFIRM_YES) {
            var app = App.getApp();
            if (app != null) { app.terminar(false); }
        }
        return true;
    }
}
