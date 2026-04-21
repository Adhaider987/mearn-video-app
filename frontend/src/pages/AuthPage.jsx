import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Eye, 
  EyeOff 
} from "lucide-react";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center relative p-5 overflow-hidden bg-premium-bg">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[80px] -top-[10%] -left-[10%] bg-premium-accent opacity-20"></div>
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[80px] -bottom-[10%] -right-[10%] bg-blue-500 opacity-15"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-[440px] p-10 rounded-3xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-premium-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-premium-accent/20">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div key="login-icon" initial={{ scale: 0.5, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: 45 }}>
                  <LogIn size={32} className="text-premium-accent" />
                </motion.div>
              ) : (
                <motion.div key="signup-icon" initial={{ scale: 0.5, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: -45 }}>
                  <UserPlus size={32} className="text-premium-accent" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <h1 className="text-3xl font-bold text-premium-text-h mb-2">{isLogin ? "Welcome Back" : "Create Account"}</h1>
          <p className="text-premium-text opacity-80">
            {isLogin ? "Sign in to connect with friends" : "Join the premium video call experience"}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm mb-5 text-center border border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-direction flex-col gap-4">
          {!isLogin && (
            <div className="relative flex items-center">
              <User size={18} className="absolute left-3.5 text-premium-text opacity-50 transition-opacity" />
              <input 
                type="text" 
                placeholder="Username" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full py-3.5 pl-11 pr-3.5 bg-white/5 border border-white/10 rounded-xl text-base text-premium-text-h focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent transition-all"
              />
            </div>
          )}
          <div className="relative flex items-center">
            <Mail size={18} className="absolute left-3.5 text-premium-text opacity-50 group-focus-within:opacity-100 transition-opacity" />
            <input 
              type="email" 
              placeholder="Email Address" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-3.5 pl-11 pr-3.5 bg-white/5 border border-white/10 rounded-xl text-base text-premium-text-h focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent transition-all"
            />
          </div>
          <div className="relative flex items-center">
            <Lock size={18} className="absolute left-3.5 text-premium-text opacity-50 transition-opacity" />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3.5 pl-11 pr-11 bg-white/5 border border-white/10 rounded-xl text-base text-premium-text-h focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-premium-text opacity-50 hover:opacity-100 transition-opacity"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3.5 bg-premium-accent text-white rounded-xl text-base font-semibold mt-2 flex items-center justify-center shadow-lg shadow-premium-accent/20 enabled:hover:scale-[1.02] active:enabled:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
            {!isLoading && <ArrowRight size={18} className="ml-2" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-premium-text">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-premium-accent font-semibold ml-1 hover:underline"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
