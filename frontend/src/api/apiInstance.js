import axios from "axios";
import { toast } from "sonner";

const apiInstance = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach token automatically
apiInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global error handling
apiInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "Something went wrong";
    
    // Global Logout on 401
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Optional: window.location.href = "/auth";
    }

    // Show toast for errors (optional, usually better to handle per-component, 
    // but good for global stuff like server down)
    if (error.code === "ERR_NETWORK") {
      toast.error("Network error: Server is unreachable");
    }

    return Promise.reject(error);
  }
);

export default apiInstance;
