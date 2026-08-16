using Toybox.Application as App;

// Un campo de datos tambien es una app: esto es solo la cascara que el sistema
// arranca para entregar el campo. El trabajo esta en BysdField.
class BysdFieldApp extends App.AppBase {

    var campo;

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        campo = new BysdField();
        return [ campo ];
    }

    // Cuando el corredor cambia el dorsal o la carrera desde el telefono.
    function onSettingsChanged() {
        if (campo != null) {
            campo.releerAjustes();
        }
    }
}
