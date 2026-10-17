// Global axios setup: sends the refresh cookie and transparently renews the
// short-lived (15 min) access token. Imported once from main.jsx.
import axios from "axios";
import BACKEND_URL from "./config";

axios.defaults.withCredentials = true;

const SESSION_KEYS = ["token", "user", "studentToken", "chatSession"];

export const clearSession = () => {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
};

// Single-flight: concurrent 401s share one refresh request.
let refreshing = null;

export const refreshAccessToken = () => {
  if (!refreshing) {
    refreshing = axios
      .post(`${BACKEND_URL}/api/auth/refresh`, null, { _skipRefresh: true })
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        return res.data.token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

export const logoutRequest = async () => {
  try {
    const token = localStorage.getItem("token");
    await axios.post(`${BACKEND_URL}/api/auth/logout`, null, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      _skipRefresh: true,
    });
  } catch {
    /* best effort: local state is cleared regardless */
  }
};

axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;

    const shouldRefresh =
      response?.status === 401 &&
      config &&
      !config._retry &&
      !config._skipRefresh &&
      config.headers?.Authorization; // only authenticated calls (not failed logins)

    if (!shouldRefresh) return Promise.reject(error);

    config._retry = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return axios(config);
    } catch {
      clearSession();
      window.location.assign("/");
      return Promise.reject(error);
    }
  }
);
