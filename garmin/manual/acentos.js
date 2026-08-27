// Recomposicion de acentos.
//
// La pagina se sirve dentro de un iframe cuyo contenido se vuelve a
// serializar por el camino: eso decodifica cualquier entidad a caracter real
// y lo emite en UTF-8 sin declarar el juego de caracteres a tiempo -el <meta>
// de arriba acaba pasado el primer kilobyte, donde ya no cuenta-. El
// navegador lee esos bytes como Windows-1252 y cada acento llega partido.
//
// Aqui se rehace al reves: cada caracter vuelve a su byte y el conjunto se
// decodifica como UTF-8. La vuelta a byte no es la identidad, y ahi estuvo el
// primer intento fallido: Windows-1252 mete puntuacion en 0x80-0x9F -la raya
// larga acaba en "a", "euro", "comilla"- y esos caracteres estan por encima
// de U+00FF, asi que hace falta la tabla. Sin ella se arreglaban las
// palabras sueltas y se quedaban rotos justo los parrafos con raya.
//
// Es seguro en los dos sentidos: el decodificador va en modo estricto, y un
// texto que ya llego bien no forma UTF-8 valido al volver a bytes, asi que
// lanza y se queda como estaba. El dia que el servidor declare el juego de
// caracteres, esto no hara nada.
(function () {
  var lector;
  try { lector = new TextDecoder("utf-8", { fatal: true }); } catch (e) { return; }

  var W1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };
  var noAscii = /[^\x00-\x7F]/;

  function rehacer(t) {
    if (!t || !noAscii.test(t)) { return t; }
    var bytes = new Uint8Array(t.length);
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c < 0x100) { bytes[i] = c; }
      else if (W1252[c] !== undefined) { bytes[i] = W1252[c]; }
      else { return t; }
    }
    try { return lector.decode(bytes); } catch (e) { return t; }
  }

  var paso = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var nodo, pendientes = [];
  while ((nodo = paso.nextNode())) { pendientes.push(nodo); }
  for (var i = 0; i < pendientes.length; i++) {
    var sano = rehacer(pendientes[i].nodeValue);
    if (sano !== pendientes[i].nodeValue) { pendientes[i].nodeValue = sano; }
  }

  // Y los rotulos que no son texto visible: el titulo de la pestana y las
  // descripciones de las esferas para el lector de pantalla.
  document.title = rehacer(document.title);
  var etiquetados = document.querySelectorAll("[aria-label]");
  for (var j = 0; j < etiquetados.length; j++) {
    etiquetados[j].setAttribute("aria-label",
      rehacer(etiquetados[j].getAttribute("aria-label")));
  }
})();
