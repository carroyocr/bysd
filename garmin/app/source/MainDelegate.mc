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
        // Sin sesion grabando no hay nada que guardar ni descartar: el menu
        // solo confundiria. No deberia pasar, pero si pasa, mejor un boton
        // muerto que un menu que no hace nada.
        var app = App.getApp();
        if (app == null || !app.grabando()) { return true; }
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
        // La regla de "no hay retroceso" protege la actividad que se esta
        // grabando. Si no hay ninguna -un cierre que se torcio a medias-,
        // tragarse el BACK dejaria al corredor atrapado en una pantalla
        // muerta, sin mas salida que apagar el reloj. Devolver false deja que
        // el sistema haga el BACK de siempre: salir de la app.
        if (app == null || !app.grabando()) { return false; }
        app.marcarVuelta();
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

// En este menu y en el de confirmar no hay ni Ui.Confirmation ni timers, y es
// a proposito: el dialogo nativo lo cierra el sistema por su cuenta JUSTO
// DESPUES de que respondemos, y cambiar de vista en ese instante era una
// carrera de tiempos. En el fenix 8 se perdia: el dialogo y la pantalla de
// cierre quedaban dibujando a la vez, alternando en los dos buferes del
// AMOLED, y se veian superpuestos (los aros de guardar y descartar mezclados
// con el cuadro rojo del dialogo). Aqui cada transicion la hacemos nosotros
// y no hay nada que pueda cruzarse: la pantalla de cierre se muestra primero
// y el trabajo de verdad lo hace ella en su onShow.
class MenuFinDelegate extends Ui.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :guardar) {
            Ui.switchToView(new SalidaView(true), new SalidaDelegate(),
                            Ui.SLIDE_IMMEDIATE);
        } else if (id == :descartar) {
            // Descartar treinta horas por un toque seria imperdonable: es la
            // unica opcion del menu que pide confirmacion.
            var menu = new Ui.Menu2({ :title => Rez.Strings.discardSure });
            menu.addItem(new Ui.MenuItem(Rez.Strings.discardYes, null, :si, null));
            menu.addItem(new Ui.MenuItem(Rez.Strings.discardNo, null, :no, null));
            Ui.pushView(menu, new ConfirmarDescarteDelegate(), Ui.SLIDE_UP);
        } else {
            Ui.popView(Ui.SLIDE_DOWN);
        }
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
    }
}

class ConfirmarDescarteDelegate extends Ui.Menu2InputDelegate {

    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item) {
        if (item.getId() == :si) {
            Ui.switchToView(new SalidaView(false), new SalidaDelegate(),
                            Ui.SLIDE_IMMEDIATE);
        } else {
            Ui.popView(Ui.SLIDE_IMMEDIATE);
        }
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_IMMEDIATE);
    }
}
