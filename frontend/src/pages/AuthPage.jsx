import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Mail, Lock, User, ArrowRight } from "lucide-react";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(username, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container" style={containerStyle}>
      <div className="auth-bg-blobs" style={blobStyle}>
        <div style={{...blob, top: '-10%', left: '-10%', background: 'var(--accent)', opacity: 0.2}}></div>
        <div style={{...blob, bottom: '-10%', right: '-10%', background: '#3b82f6', opacity: 0.15}}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass auth-card"
        style={cardStyle}
      >
        <div style={headerStyle}>
          <div style={logoWrapper}>
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div key="login-icon" initial={{ scale: 0.5, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: 45 }}>
                  <LogIn size={32} color="var(--accent)" />
                </motion.div>
              ) : (
                <motion.div key="signup-icon" initial={{ scale: 0.5, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: -45 }}>
                  <UserPlus size={32} color="var(--accent)" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <h1>{isLogin ? "Welcome Back" : "Create Account"}</h1>
          <p style={{ color: "var(--text)", opacity: 0.8 }}>
            {isLogin ? "Sign in to connect with friends" : "Join the premium video call experience"}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={errorStyle}
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          {!isLogin && (
            <div style={inputWrapper}>
              <User size={18} style={iconStyle} />
              <input 
                type="text" 
                placeholder="Username" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}
          <div style={inputWrapper}>
            <Mail size={18} style={iconStyle} />
            <input 
              type="email" 
              placeholder="Email Address" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={inputWrapper}>
            <Lock size={18} style={iconStyle} />
            <input 
              type="password" 
              placeholder="Password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={buttonStyle}
          >
            {isLoading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
            {!isLoading && <ArrowRight size={18} style={{ marginLeft: 8 }} />}
          </button>
        </form>

        <div style={footerStyle}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={toggleButtonStyle}
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Styles
const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  padding: "20px",
  overflow: "hidden",
  background: "var(--bg)",
};

const blobStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
};

const blob = {
  position: "absolute",
  width: "600px",
  height: "600px",
  borderRadius: "50%",
  filter: "blur(80px)",
};

const cardStyle = {
  width: "100%",
  maxWidth: "440px",
  padding: "40px",
  borderRadius: "24px",
  position: "relative",
  zIndex: 1,
};

const headerStyle = {
  textAlign: "center",
  marginBottom: "32px",
};

const logoWrapper = {
  width: "64px",
  height: "64px",
  background: "var(--accent-bg)",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 16px",
  border: "1px solid var(--accent-border)",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const inputWrapper = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const iconStyle = {
  position: "absolute",
  left: "14px",
  color: "var(--text)",
  opacity: 0.5,
};

const inputStyle = {
  width: "100%",
  padding: "14px 14px 14px 44px",
  background: "var(--social-bg)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: "16px",
  color: "var(--text-h)",
  boxSizing: "border-box",
};

const buttonStyle = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  padding: "14px",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: "600",
  marginTop: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(170, 59, 255, 0.3)",
};

const errorStyle = {
  background: "rgba(239, 68, 68, 0.1)",
  color: "#ef4444",
  padding: "12px",
  borderRadius: "10px",
  fontSize: "14px",
  marginBottom: "20px",
  textAlign: "center",
  border: "1px solid rgba(239, 68, 68, 0.2)",
};

const footerStyle = {
  marginTop: "24px",
  textAlign: "center",
  fontSize: "14px",
  color: "var(--text)",
};

const toggleButtonStyle = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontWeight: "600",
  fontSize: "14px",
  padding: "0",
  marginLeft: "4px",
};

export default AuthPage;
