/**
 * Open Graph Middleware for CRACO Dev Server
 * Dynamically replaces OG meta tags in index.html with active race data.
 * This ensures WhatsApp/Facebook/Twitter previews show the current race info.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

let cachedRaceData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

const EDITION_LABELS = [
  "", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta",
  "Sexta", "Septima", "Octava", "Novena", "Decima"
];

function getEditionLabel(n) {
  if (n >= 1 && n < EDITION_LABELS.length) return EDITION_LABELS[n];
  return `${n}a`;
}

function fetchActiveRace() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:8001/api/race-config/active", { timeout: 3000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function getRaceData() {
  const now = Date.now();
  if (cachedRaceData && now - cacheTimestamp < CACHE_TTL) {
    return cachedRaceData;
  }
  const data = await fetchActiveRace();
  if (data) {
    cachedRaceData = data;
    cacheTimestamp = now;
  }
  return cachedRaceData;
}

function replaceMetaTags(html, race) {
  if (!race) return html;

  const name = race.name || "Backyard Ultra Santo Domingo";
  const edition = race.edition_number || 1;
  const edLabel = getEditionLabel(edition);
  const location = (race.location || "Santo Domingo, Republica Dominicana").split(",").slice(-2).join(",").trim();
  const description = `${edLabel} edicion del Backyard Ultra en ${location}. Un desafio personal, un ejercicio de disciplina, una prueba de voluntad.`;

  // Build absolute image URL from race logo
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  let imageUrl = race.logo_home_url || race.logo_url || "/logo-backyard-ultra.png";
  if (imageUrl.startsWith("/api/")) {
    imageUrl = backendUrl + imageUrl;
  } else if (imageUrl.startsWith("/")) {
    imageUrl = backendUrl + imageUrl;
  }

  const replacements = [
    [/(<meta\s+name="description"\s+content=")([^"]*)(")/, `$1${description}$3`],
    [/(<meta\s+property="og:title"\s+content=")([^"]*)(")/, `$1${name}$3`],
    [/(<meta\s+property="og:description"\s+content=")([^"]*)(")/, `$1${description}$3`],
    [/(<meta\s+property="og:image"\s+content=")([^"]*)(")/, `$1${imageUrl}$3`],
    [/(<meta\s+property="og:site_name"\s+content=")([^"]*)(")/, `$1${name}$3`],
    [/(<meta\s+name="twitter:title"\s+content=")([^"]*)(")/, `$1${name}$3`],
    [/(<meta\s+name="twitter:description"\s+content=")([^"]*)(")/, `$1${description}$3`],
    [/(<meta\s+name="twitter:image"\s+content=")([^"]*)(")/, `$1${imageUrl}$3`],
    [/(<title>)([^<]*)(<\/title>)/, `$1${name}$3`],
  ];

  for (const [regex, replacement] of replacements) {
    html = html.replace(regex, replacement);
  }
  return html;
}

function setupOgMiddleware(devServerConfig) {
  const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

  devServerConfig.setupMiddlewares = (middlewares, devServer) => {
    // Add OG middleware at the very beginning (before static files)
    middlewares.unshift({
      name: "og-meta-middleware",
      middleware: async (req, res, next) => {
        // Only intercept root HTML page requests (not assets, not API)
        const accept = req.headers.accept || "";
        const isHtmlRequest = accept.includes("text/html");
        const isAsset = /\.\w+$/.test(req.url) && !req.url.endsWith(".html");
        const isApi = req.url.startsWith("/api/");
        const isHotUpdate = req.url.includes("hot-update") || req.url.includes("__webpack");
        const isSockJs = req.url.includes("/ws") || req.url.includes("sockjs");

        if (!isHtmlRequest || isAsset || isApi || isHotUpdate || isSockJs) {
          return next();
        }

        try {
          const indexPath = path.resolve(__dirname, "../public/index.html");
          let html = fs.readFileSync(indexPath, "utf-8");

          const race = await getRaceData();
          html = replaceMetaTags(html, race);

          // Replace %PUBLIC_URL% placeholder (CRA convention)
          html = html.replace(/%PUBLIC_URL%/g, "");

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (err) {
          // If anything fails, fall through to default handler
          next();
        }
      },
    });

    // Chain original middleware setup if exists
    if (originalSetupMiddlewares) {
      middlewares = originalSetupMiddlewares(middlewares, devServer);
    }

    return middlewares;
  };

  return devServerConfig;
}

module.exports = { setupOgMiddleware };
