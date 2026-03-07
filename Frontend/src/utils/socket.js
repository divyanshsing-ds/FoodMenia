import { io } from "socket.io-client";
import CONFIG from "./config";

// The socket server is at the same base URL as the API, just without the /api suffix
const SOCKET_URL = CONFIG.API_BASE.replace("/api", "");

const socket = io(SOCKET_URL, {
    autoConnect: false, // Don't connect until we have a token or need it
});

export default socket;
