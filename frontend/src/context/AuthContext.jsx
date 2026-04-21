import React, { createContext, useState, useEffect, useContext } from "react";
import apiInstance from "../api/apiInstance";
import { toast } from "sonner";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      fetchUser();
    } else {
      localStorage.removeItem("token");
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await apiInstance.get("/auth/me");
      setUser(res.data);
    } catch (err) {
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await apiInstance.post("/auth/login", { email, password });
    setToken(res.data.token);
    // Normalize user object since backend might return 'id' or '_id'
    const userData = res.data.user;
    setUser({ ...userData, _id: userData.id || userData._id });
    toast.success("Welcome back!");
    return res.data;
  };

  const signup = async (username, email, password) => {
    const res = await apiInstance.post("/auth/signup", { username, email, password });
    setToken(res.data.token);
    const userData = res.data.user;
    setUser({ ...userData, _id: userData.id || userData._id });
    toast.success("Account created successfully!");
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    toast.info("Logged out");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
