import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiInstance from "../api/apiInstance";
import { 
  MessageSquare, 
  Users, 
  Video, 
  Bell, 
  Settings, 
  LogOut 
} from "lucide-react";
import VideoCallOverlay from "../components/VideoCallOverlay";
const Dashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState(null);

  // Global socket listeners for real-time updates
  useEffect(() => {
    if (socket) {
      const handleUserStatus = () => {
        // Cache invalidation handled by refetchInterval for now
      };

      const handleFriendRequest = ({ sender }) => {
        toast.info(`New friend request from ${sender.username}`, {
          description: "Would you like to connect?",
          action: {
            label: "Accept",
            onClick: async () => {
              try {
                await apiInstance.post("/friends/respond", { fromUserId: sender._id, accept: true });
                toast.success(`You are now friends with ${sender.username}`);
                queryClient.invalidateQueries({ queryKey: ["friends"] });
                queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
              } catch (err) {
                toast.error("Failed to accept request");
              }
            }
          },
          cancel: {
            label: "Decline",
            onClick: () => {
              apiInstance.post("/friends/respond", { fromUserId: sender._id, accept: false });
            }
          }
        });
      };

      const handleIncomingCall = ({ sender, type, roomId }) => {
        const toastId = toast.info(`Incoming ${type} call from ${sender.username}`, {
          description: "Do you want to join?",
          duration: 30000, // 30s ringing
          action: {
            label: "Join",
            onClick: () => {
              setActiveCall({ roomId, friend: sender, type });
              socket.emit("call-response", { callerId: sender._id, accept: true, roomId });
            }
          },
          cancel: {
            label: "Decline",
            onClick: () => {
              socket.emit("call-response", { callerId: sender._id, accept: false, roomId });
            }
          }
        });
      };

      const handleNewMessage = (msg) => {
        const currentPath = location.pathname;
        const senderId = msg.sender._id;
        
        // Only notify if not in the active chat with this person
        if (!currentPath.includes(`/dashboard/chat/${senderId}`)) {
          toast.message(`New message from ${msg.sender.username}`, {
            description: msg.content.length > 30 ? msg.content.substring(0, 30) + "..." : msg.content,
            action: {
              label: "View",
              onClick: () => {
                // Navigate to the chat
                navigate(`/dashboard/chat/${senderId}`);
              }
            }
          });
          queryClient.invalidateQueries({ queryKey: ["messages", senderId] });
        }
      };
      
      socket.on("user-status", handleUserStatus);
      socket.on("friend-request", handleFriendRequest);
      socket.on("incoming-call", handleIncomingCall);
      socket.on("new-message", handleNewMessage);

      return () => {
        socket.off("user-status", handleUserStatus);
        socket.off("friend-request", handleFriendRequest);
        socket.off("incoming-call", handleIncomingCall);
        socket.off("new-message", handleNewMessage);
      };
    }
  }, [socket, location.pathname, queryClient]);

  // Fetch count of pending requests for the badge
  const { data: pendingRequests } = useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/pending");
      return res.data;
    },
    initialData: [],
    refetchInterval: 30000, // Background refresh every 30s
  });

  return (
    <div className="dashboard-layout" style={dashboardStyle}>
      {/* Sidebar Navigation */}
      <aside className="glass" style={sidebarStyle}>
        <div style={sidebarTop}>
          <div style={logoStyle}>AG</div>
          <nav style={navStyle}>
            <NavLink 
              to="/dashboard/chat" 
              style={({ isActive }) => isActive ? navItemActive : navItem}
            >
              <MessageSquare size={24} />
            </NavLink>
            <NavLink 
              to="/dashboard/friends" 
              style={({ isActive }) => isActive ? navItemActive : navItem}
            >
              <Users size={24} />
              {pendingRequests.length > 0 && <span style={badgeStyle}>{pendingRequests.length}</span>}
            </NavLink>
            <button style={navItem}><Video size={24} /></button>
            <button style={navItem}><Bell size={24} /></button>
          </nav>
        </div>
        <div style={sidebarBottom}>
          <button style={navItem}><Settings size={24} /></button>
          <button onClick={logout} style={{...navItem, color: '#ef4444'}}><LogOut size={24} /></button>
        </div>
      </aside>

      {/* Main Content Area (Rendered by Router) */}
      <main style={mainContentStyle}>
        <Outlet context={{ setActiveCall }} />
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

// Styles (unchanged from previous or slightly adjusted)
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
  cursor: "pointer",
  transition: "all 0.2s ease",
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

export default Dashboard;
