using Toybox.Application as App;
using Toybox.Graphics as Gfx;

// El tema de la esfera: fondo oscuro o fondo claro.
//
// La app nacio con fondo negro, que en las AMOLED es la esquina de la que
// sale la bateria. Pero en las pantallas MIP -los Forerunner 255 y 955, los
// fenix de antes del 8, los Instinct- el tema de fabrica del reloj es claro
// y un fondo negro se ve apagado; un usuario de la tienda lo pidio al reves.
// Asi que el fondo es un ajuste, y las vistas no nombran nunca el negro ni el
// blanco: piden aqui el fondo, la tinta y los dos grises, y este modulo los
// da segun el tema.
//
// Los colores con significado -el naranja de la vuelta, el semaforo del
// corral, el rojo del margen, el azul del total- son los mismos en los dos
// temas. Solo el verde cambia: el COLOR_GREEN puro sobre blanco casi no se
// lee, y en el tema claro se escribe con el verde oscuro.
//
// Un campo de datos no necesita nada de esto: lee el fondo del sistema con
// getBackgroundColor(). Una app no tiene esa API, y por eso es un ajuste.
module Tema {

    const OSCURO = 0;
    const CLARO = 1;

    const NORMAL = 0;
    const GRANDE = 1;

    // El tema y el tamano de texto en uso. Se leen de las propiedades al
    // arrancar, al cambiarlos en el reloj y cuando llega un cambio desde el
    // telefono: las vistas se repintan cada segundo y no es sitio para ir a
    // leer propiedades.
    var claro = false;
    var grande = false;

    function leer() {
        claro = (_propiedad("theme") == CLARO);
        grande = (_propiedad("textSize") == GRANDE);
    }

    function _propiedad(clave) {
        try {
            var v = App.Properties.getValue(clave);
            return v == null ? 0 : v.toNumber();
        } catch (e) {
            return 0;
        }
    }

    // Cambia el tema desde el reloj y lo deja guardado para el telefono.
    function alternar() {
        try {
            App.Properties.setValue("theme", claro ? OSCURO : CLARO);
        } catch (e) {
        }
        leer();
    }

    // Lo mismo con el tamano de texto.
    function alternarTexto() {
        try {
            App.Properties.setValue("textSize", grande ? NORMAL : GRANDE);
        } catch (e) {
        }
        leer();
    }

    // El tamano de texto. Con "grande" cada fuente sube un escalon: los
    // rotulos de XTINY a TINY, las cifras de la cuadricula de MILD a MEDIUM
    // y las cifras grandes de MEDIUM a HOT. Las que ya son las mas gruesas
    // del reloj -HOT en el descanso y el corral, THAI_HOT en el ultimo
    // minuto- no suben: no hay nada mas arriba que quepa en la esfera.
    //
    // Quien dibuja comprueba despues si el texto cabe en su sitio y, si no,
    // vuelve a la fuente de siempre: en una esfera de 218 px "+11:23" en
    // HOT se sale, y mejor pequeno que cortado. Lo pidio el mismo usuario
    // del Forerunner 255: a esa resolucion el XTINY se le quedaba corto.
    function fuente(f) {
        if (!grande) { return f; }
        if (f == Gfx.FONT_XTINY) { return Gfx.FONT_TINY; }
        if (f == Gfx.FONT_NUMBER_MILD) { return Gfx.FONT_NUMBER_MEDIUM; }
        if (f == Gfx.FONT_NUMBER_MEDIUM) { return Gfx.FONT_NUMBER_HOT; }
        return f;
    }

    function fondo() {
        return claro ? Gfx.COLOR_WHITE : Gfx.COLOR_BLACK;
    }

    // La tinta principal: las cifras grandes.
    function tinta() {
        return claro ? Gfx.COLOR_BLACK : Gfx.COLOR_WHITE;
    }

    // La tinta secundaria: rotulos y lineas de contexto. Sobre negro era el
    // gris claro; sobre blanco es el oscuro.
    function tenue() {
        return claro ? Gfx.COLOR_DK_GRAY : Gfx.COLOR_LT_GRAY;
    }

    // El mueble: aros de fondo, lineas del marco, migas sin foco. Lo que
    // menos contrasta con el fondo en cualquiera de los dos temas. SOLO para
    // lo dibujado, nunca para texto: en una pantalla MIP este gris casi no
    // se ve, y las lineas de pie que iban en el se quedaban sin leer
    // (Forerunner 255, primera prueba de la 1.8.0). El texto secundario va
    // siempre en tenue().
    function apagado() {
        return claro ? Gfx.COLOR_LT_GRAY : Gfx.COLOR_DK_GRAY;
    }

    // El verde de "bien": GPS listo, margen a favor, descanso, ajuste puesto.
    function verde() {
        return legible(Gfx.COLOR_GREEN);
    }

    // Un color de acento escrito como TEXTO sobre el fondo. Sobre negro todos
    // valen; sobre blanco el verde puro se oscurece y el amarillo -el corral
    // a tres minutos- se escribe en tinta, porque amarillo sobre blanco no
    // se lee. Los aros no pasan por aqui: un aro ancho amarillo sobre blanco
    // se ve, y el semaforo tiene que seguir siendo amarillo, naranja y rojo.
    function legible(color) {
        if (!claro) { return color; }
        if (color == Gfx.COLOR_GREEN) { return Gfx.COLOR_DK_GREEN; }
        if (color == Gfx.COLOR_YELLOW) { return Gfx.COLOR_BLACK; }
        return color;
    }
}
