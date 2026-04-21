import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  LogOut,
  X,
  Info
} from "lucide-react";
import VideoCallOverlay from "../components/VideoCallOverlay";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [activeCall, setActiveCall] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Global socket listeners for real-time updates
  useEffect(() => {
    if (socket) {
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
          }
        });
      };

      const handleIncomingCall = ({ sender, type, roomId }) => {
        setActiveCall({ roomId, friend: sender, type, isIncoming: true, status: 'ringing' });
      };

      const handleNewMessage = (msg) => {
        const currentPath = locationRef.current;
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
      
      socket.on("friend-request", handleFriendRequest);
      socket.on("incoming-call", handleIncomingCall);
      socket.on("new-message", handleNewMessage);
      socket.on("call-ended", () => setActiveCall(null));

      return () => {
        socket.off("friend-request", handleFriendRequest);
        socket.off("incoming-call", handleIncomingCall);
        socket.off("new-message", handleNewMessage);
        socket.off("call-ended");
      };
    }
  }, [socket, queryClient, navigate, user._id]);

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/pending");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const startInstantMeeting = () => {
    const roomId = `room-${Math.random().toString(36).substring(7)}`;
    setActiveCall({
      roomId,
      friend: { username: "Instant Room", _id: "temp" },
      type: "video",
      isIncoming: false,
      status: "connecting"
    });
    toast.success("Instant meeting started! Use the Room ID to invite others.", {
      description: `Room ID: ${roomId}`,
      action: {
        label: "Copy",
        onClick: () => navigator.clipboard.writeText(roomId)
      }
    });
  };

  const NavItems = () => (
    <>
      <NavLink to="/dashboard/chat" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <MessageSquare size={24} />
      </NavLink>
      <NavLink to="/dashboard/friends" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <Users size={24} />
        {pendingRequests.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-premium-bg" />}
      </NavLink>
      <button onClick={startInstantMeeting} className="nav-item">
        <Video size={24} />
      </button>
      <button onClick={() => setIsNotificationsOpen(true)} className="nav-item">
        <Bell size={24} />
        {pendingRequests.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-premium-accent rounded-full border-2 border-premium-bg" />}
      </button>
    </>
  );

  return (
    <div className="flex h-screen bg-premium-bg text-premium-text-h overflow-hidden font-sans">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="w-20 flex flex-col justify-between items-center py-6 border-r border-white/5 z-[100] bg-premium-bg hidden md:flex">
        <div className="flex flex-col items-center gap-8">
          <div className="w-12 h-12 bg-premium-accent rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-premium-accent/20">AG</div>
          <nav className="flex flex-col gap-3">
            <NavItems />
          </nav>
        </div>
        <div className="flex flex-col gap-3">
          <button className="nav-item"><Settings size={24} /></button>
          <button onClick={logout} className="nav-item text-red-500 hover:bg-red-500/10"><LogOut size={24} /></button>
        </div>
      </aside>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-6 left-6 right-6 h-[72px] flex justify-evenly items-center z-[100] rounded-[24px] glass md:hidden">
        <NavItems />
        <button onClick={logout} className="nav-item text-red-500"><LogOut size={24} /></button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-premium-bg-alt relative">
        <Outlet context={{ setActiveCall }} />
      </main>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm glass z-[210] p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bell size={20} className="text-premium-accent" />
                  Notifications
                </h2>
                <button onClick={() => setIsNotificationsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {pendingRequests.length > 0 ? (
                  pendingRequests.map(req => (
                    <div key={req._id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-premium-accent/20 rounded-xl flex items-center justify-center text-premium-accent font-bold uppercase">
                          {req.username[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{req.username}</p>
                          <p className="text-xs text-premium-text opacity-70">Wants to be your friend</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => navigate('/dashboard/friends')}
                          className="flex-1 py-2 bg-premium-accent text-white rounded-lg text-xs font-semibold"
                        >
                          Review Request
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <Info size={48} className="mb-4" />
                    <p className="text-sm font-medium">All caught up!</p>
                    <p className="text-xs">No new notifications at this time.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
