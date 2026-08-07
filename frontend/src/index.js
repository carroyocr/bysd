import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { initNativeStorage } from "@/lib/nativeStorage";

// En la app nativa restaura el almacenamiento persistido antes de montar
// React, para que el código que lee localStorage al inicializar encuentre
// los datos. En la web resuelve de inmediato.
initNativeStorage().then(() => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
