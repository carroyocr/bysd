using Toybox.Application as App;

// La puerta de entrada del campo de datos.
//
// Un campo de datos no arranca por su vista: arranca por una AppBase, igual
// que la app de reloj, y esa AppBase le entrega la vista al sistema. Aqui esa
// clase no hace mucho mas, porque en un campo de datos el latido de un segundo
// lo pone el propio reloj llamando a compute(): no hace falta ningun Timer.
class BackyardFieldApp extends App.AppBase {

    var estado;

    function initialize() {
        AppBase.initialize();
        // En initialize y no en onStart: getInitialView puede llegar antes, y
        // entonces la vista se construiria sin estado.
        estado = new RaceState();
    }

    function getInitialView() {
        return [ new BackyardField(estado) ];
    }

    // Cuando el corredor cambia la vuelta o el aviso desde el telefono.
    function onSettingsChanged() {
        estado.leerAjustes();
    }
}
