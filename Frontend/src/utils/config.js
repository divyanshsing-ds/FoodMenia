// Project-wide configuration
const API_BASE_URL = "http://localhost:9090/api";
const UPLOADS_BASE_URL = "http://localhost:9090";

const CONFIG = {
    API_BASE: API_BASE_URL,
    UPLOADS_BASE: UPLOADS_BASE_URL,

    // Role-isolated localStorage keys (Option B)
    // Each role gets its own token + data slot so sessions never overwrite each other.
    KEYS: {
        user: { token: "userToken", data: "userData" },
        operator: { token: "operatorToken", data: "operatorData" },
        creator: { token: "creatorToken", data: "creatorData" },
    },

    /** Helper: return the token key for a given role */
    tokenKey: (role) => CONFIG.KEYS[role]?.token || "userToken",

    /** Helper: return the data key for a given role */
    dataKey: (role) => CONFIG.KEYS[role]?.data || "userData",
};

export default CONFIG;
