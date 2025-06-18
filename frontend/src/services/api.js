import axios from 'axios';
import { store } from '../store/store';
import { logout } from '../store/slices/authSlice';

// Create axios instance
const api = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',  // Добавяме /api в baseURL
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Log configuration on startup
console.log('API Configuration:', {
  baseURL: api.defaults.baseURL,
  timeout: api.defaults.timeout,
  headers: api.defaults.headers
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

    // Log each request
    console.log('API Request:', {
      fullUrl: `${config.baseURL}${config.url}`,
      method: config.method,
      hasToken: !!token
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    console.log('API Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Enhanced error logging
    console.error('API Response Error:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    // Handle 401 errors by logging out the user
    if (error.response?.status === 401) {
      const state = store.getState();
      if (state.auth.isAuthenticated) {
        console.log('401 Unauthorized - logging out user');
        store.dispatch(logout());
      }
    }

    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(error);
  }
);

export default api;