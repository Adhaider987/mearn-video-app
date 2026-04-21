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
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState(null);

  // ... (EventListeners, useQuery, etc. remain the same)
  useEffect(() => {
    if (socket) {
      const handleUserStatus = () => {};

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
          duration: 30000, 
          action: {
            label: "Join",
            onClick: () => {
              setActiveCall({ roomId, friend: sender, type, isIncoming: true });
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
        const senderId = (msg.sender._id || msg.sender.id)?.toString();
        if (senderId === user?._id?.toString()) return;
        const isCurrentChat = currentPath.endsWith(`/chat/${senderId}`) || currentPath.includes(`/chat/${senderId}/`);

        if (!isCurrentChat) {
          toast.message(`New message from ${msg.sender.username}`, {
            description: msg.content.length > 30 ? msg.content.substring(0, 30) + "..." : msg.content,
            action: {
              label: "View",
              onClick: () => { navigate(`/dashboard/chat/${senderId}`); }
            }
          });
          queryClient.invalidateQueries({ queryKey: ["messages", senderId] });
        }
      };
      
      socket.on("user-status", handleUserStatus);
      socket.on("friend-request", handleFriendRequest);
      socket.on("incoming-call", handleIncomingCall);
      socket.on("new-message", handleNewMessage);
      socket.on("call-ended", () => setActiveCall(null));

      return () => {
        socket.off("user-status", handleUserStatus);
        socket.off("friend-request", handleFriendRequest);
        socket.off("incoming-call", handleIncomingCall);
        socket.off("new-message", handleNewMessage);
        socket.off("call-ended");
      };
    }
  }, [socket, location.pathname, queryClient, navigate, user._id]);

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/pending");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const NavItems = () => (
    <>
      <NavLink to="/dashboard/chat" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <MessageSquare size={24} />
      </NavLink>
      <NavLink to="/dashboard/friends" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <Users size={24} />
        {pendingRequests.length > 0 && <span className="nav-badge" />}
      </NavLink>
      <button className="nav-item"><Video size={24} /></button>
      <button className="nav-item"><Bell size={24} /></button>
    </>
  );

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="dashboard-sidebar glass hidden-mobile">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '20px' }}>AG</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <NavItems />
          </nav>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="nav-item"><Settings size={24} /></button>
          <button onClick={logout} className="nav-item" style={{ color: '#ef4444' }}><LogOut size={24} /></button>
        </div>
      </aside>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav glass only-mobile">
        <NavItems />
        <button onClick={logout} className="nav-item" style={{ color: '#ef4444' }}><LogOut size={24} /></button>
      </nav>

      {/* Main Content Area */}
      <main className="dashboard-main">
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

export default Dashboard;
