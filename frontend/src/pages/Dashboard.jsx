import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import { 
  Search, 
  Users, 
  MessageSquare, 
  Video, 
  LogOut, 
  User as UserIcon,
  Bell,
  Settings,
  Plus
} from "lucide-react";

// Components (defined below for simplicity, or can be separate files)
import FriendsSidebar from "../components/FriendsSidebar";
import ChatArea from "../components/ChatArea";
import VideoCallOverlay from "../components/VideoCallOverlay";

const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const socket = useSocket();
  
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeCall, setActiveCall] = useState(null); // { roomId, type: 'video'|'audio' }
  const [notifications, setNotifications] = useState([]);
  
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
    
    if (socket) {
      socket.on("user-status", ({ userId, online }) => {
        setFriends(prev => prev.map(f => f._id === userId ? { ...f, online } : f));
      });
      
      socket.on("friend-request", () => {
        fetchPendingRequests();
      });

      return () => {
        socket.off("user-status");
        socket.off("friend-request");
      };
    }
  }, [socket]);

  const fetchFriends = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/friends/list", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(res.data);
    } catch (err) {
      console.error("Error fetching friends", err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/friends/pending", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRequests(res.data);
    } catch (err) {
      console.error("Error fetching pending requests", err);
    }
  };

  const startCall = (friend, type = 'video') => {
    // Generate a room ID based on user IDs
    const roomId = [user._id, friend._id].sort().join("-");
    setActiveCall({ roomId, friend, type });
  };

  return (
    <div className="dashboard-layout" style={dashboardStyle}>
      {/* Sidebar Navigation */}
      <aside className="glass" style={sidebarStyle}>
        <div style={sidebarTop}>
          <div style={logoStyle}>AG</div>
          <nav style={navStyle}>
            <button style={navItemActive}><MessageSquare size={24} /></button>
            <button style={navItem}><Users size={24} /></button>
            <button style={navItem}><Video size={24} /></button>
            <button style={navItem}><Bell size={24} />{pendingRequests.length > 0 && <span style={badgeStyle}>{pendingRequests.length}</span>}</button>
          </nav>
        </div>
        <div style={sidebarBottom}>
          <button style={navItem}><Settings size={24} /></button>
          <button onClick={logout} style={{...navItem, color: '#ef4444'}}><LogOut size={24} /></button>
        </div>
      </aside>

      {/* Friends List Sidebar */}
      <FriendsSidebar 
        friends={friends} 
        pendingRequests={pendingRequests}
        onSelectFriend={setSelectedFriend}
        selectedFriend={selectedFriend}
        onRefresh={fetchFriends}
      />

      {/* Main Chat Area */}
      <main style={mainContentStyle}>
        {selectedFriend ? (
          <ChatArea 
            friend={selectedFriend} 
            onStartCall={(type) => startCall(selectedFriend, type)} 
          />
        ) : (
          <div style={emptyStateStyle}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={emptyCard}
            >
              <div style={welcomeIcon}><MessageSquare size={48} color="var(--accent)" /></div>
              <h2>Select a friend to start chatting</h2>
              <p>Connect with your friends via high-quality audio and video calls.</p>
            </motion.div>
          </div>
        )}
      </main>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {activeCall && (
          <VideoCallOverlay 
            callData={activeCall} 
            onClose={() => setActiveCall(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Styles
const dashboardStyle = {
  display: "flex",
  height: "100vh",
  background: "var(--bg)",
  color: "var(--text-h)",
  overflow: "hidden",
};

const sidebarStyle = {
  width: "80px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 0",
  borderRight: "1px solid var(--border)",
  zIndex: 10,
};

const sidebarTop = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "32px",
};

const logoStyle = {
  width: "48px",
  height: "48px",
  background: "var(--accent)",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: "800",
  fontSize: "20px",
};

const navStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const navItem = {
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  color: "var(--text)",
  opacity: 0.6,
  position: "relative",
};

const navItemActive = {
  ...navItem,
  background: "var(--accent-bg)",
  color: "var(--accent)",
  opacity: 1,
};

const badgeStyle = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "10px",
  height: "10px",
  background: "#ef4444",
  borderRadius: "50%",
  border: "2px solid var(--bg)",
};

const sidebarBottom = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const mainContentStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  background: "var(--code-bg)",
  position: "relative",
};

const emptyStateStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
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

export default Dashboard;
