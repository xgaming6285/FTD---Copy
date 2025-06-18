import axios from "axios";
import { store } from "../store/store";
import { logout } from "../store/slices/authSlice";

// Your main backend API
const backendAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// External agent reporting API
const externalAPI = axios.create({
  baseURL: "https://agent-report-scraper.onrender.com/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Add auth token to backend API requests
backendAPI.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

    console.log("Backend API Request:", {
      fullUrl: `${config.baseURL}${config.url}`,
      method: config.method,
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error("Backend API Request Error:", error);
    return Promise.reject(error);
  }
);

// Log external API requests
externalAPI.interceptors.request.use(
  (config) => {
    console.log("External API Request:", {
      fullUrl: `${config.baseURL}${config.url}`,
      method: config.method,
    });
    return config;
  },
  (error) => {
    console.error("External API Request Error:", error);
    return Promise.reject(error);
  }
);

// Handle backend API responses
backendAPI.interceptors.response.use(
  (response) => {
    console.log("Backend API Response:", {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error) => {
    console.error("Backend API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });

    // Handle authentication errors
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }

    if (!error.response) {
      error.message = "Network error. Please check your connection.";
    }

    return Promise.reject(error);
  }
);

// Handle external API responses
externalAPI.interceptors.response.use(
  (response) => {
    console.log("External API Response:", {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error) => {
    console.error("External API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });

    if (!error.response) {
      error.message =
        "External API network error. Please check your connection.";
    }

    return Promise.reject(error);
  }
);

// Create a unified API object that routes to the correct API
const api = {
  // Backend API methods (for auth, orders, leads, users, etc.)
  get: (url, config) => {
    if (url.startsWith("/mongodb/")) {
      // Route agent data requests to external API
      return externalAPI.get(url, config);
    }
    return backendAPI.get(url, config);
  },

  post: (url, data, config) => {
    if (url.startsWith("/mongodb/")) {
      return externalAPI.post(url, data, config);
    }
    return backendAPI.post(url, data, config);
  },

  put: (url, data, config) => {
    if (url.startsWith("/mongodb/")) {
      return externalAPI.put(url, data, config);
    }
    return backendAPI.put(url, data, config);
  },

  delete: (url, config) => {
    if (url.startsWith("/mongodb/")) {
      return externalAPI.delete(url, config);
    }
    return backendAPI.delete(url, config);
  },

  patch: (url, data, config) => {
    if (url.startsWith("/mongodb/")) {
      return externalAPI.patch(url, data, config);
    }
    return backendAPI.patch(url, data, config);
  },
};

export default api;
