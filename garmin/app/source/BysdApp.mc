using Toybox.Application as App;
using Toybox.WatchUi as Ui;
using Toybox.Timer as Timer;

// BYSD Live: la app de reloj.
//
// Late una vez por segundo. El trabajo de cada latido (mirar si cambio la
// vuelta, decidir si toca preguntar al servidor, avisar del corral) esta en
// Latido, que comparte con el campo de datos. Aqui solo queda el temporizador
// y pedir que se repinte.
class BysdApp extends App.AppBase {

    var estado;
    var api;
    var latido;

    var _timer;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        estado = new RaceState();
        api = new ApiClient(estado);
        latido = new Latido(estado, api);
        _timer = new Timer.Timer();
        _timer.start(method(:tic), 1000, true);
    }

    function onStop(state) {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    // Cuando el corredor cambia el dorsal o la carrera desde el telefono.
    function onSettingsChanged() {
        estado.leerAjustes();
        latido.refrescar();
    }

    function getInitialView() {
        return [ new SplashView(estado), new SplashDelegate(estado) ];
    }

    function tic() {
        latido.tic();
        Ui.requestUpdate();
    }
}
