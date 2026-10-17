// Set VITE_BACKEND_URL at build time (see .env.example).
//  - unset          -> local dev server (http://localhost:5001)
//  - ""  (empty)    -> same origin (used by the Docker/nginx setup, which proxies /api and /socket.io)
//  - "https://..."  -> a separately hosted API
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5001";

export default BACKEND_URL;
