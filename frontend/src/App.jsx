import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ChatArea from "./components/ChatArea";
import FriendsSidebar from "./components/FriendsSidebar";
import PrivateRoute from "./components/PrivateRoute";
import FindFriends from "./pages/FindFriends";

import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import ChatLayout from "./components/ChatLayout";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          >
            <Route index element={<Navigate to="chat" />} />
            <Route path="chat" element={<ChatLayout />}>
              <Route index element={<EmptyChatState />} />
              <Route path=":friendId" element={<ChatArea />} />
            </Route>
            <Route path="friends" element={<FindFriends />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  );
}

// Premium Empty Chat State Component
const EmptyChatState = () => (
  <div style={emptyStateStyle}>
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={emptyCard}
    >
      <div style={welcomeIcon}>
        <MessageSquare size={48} color="var(--accent)" />
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
        Select a conversation
      </h2>
      <p style={{ color: 'var(--text)', opacity: 0.6, maxWidth: '280px', margin: '0 auto' }}>
        Choose a friend from the sidebar or discover new people to start your high-quality video journey.
      </p>
    </motion.div>
  </div>
);

// Styles for Empty State (matching Dashboard theme)
const emptyStateStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  background: "var(--code-bg)",
};

const emptyCard = {
  textAlign: "center",
  maxWidth: "400px",
};

const welcomeIcon = {
  width: "100px",
  height: "100px",
  background: "var(--accent-bg)",
  borderRadius: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 24px",
};

export default App;
