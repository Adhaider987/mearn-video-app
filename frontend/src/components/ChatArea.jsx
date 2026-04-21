import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, Phone, MoreVertical, Smile, Paperclip } from "lucide-react";
import { useParams, useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../api/apiInstance";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { toast } from "sonner";

const ChatArea = () => {
  const { friendId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const { setActiveCall } = useOutletContext();
  const queryClient = useQueryClient();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  // Fetch Friend Details (To get active friend info)
  const { data: friends = [] } = useQuery({ 
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/list");
      return res.data;
    }
  });
  const friend = friends.find(f => f._id === friendId);

  // Fetch Message History
  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["messages", friendId],
    queryFn: async () => {
      const res = await apiInstance.get(`/messages/${friendId}`);
      return res.data;
    },
    enabled: !!friendId,
  });

  useEffect(() => {
    if (history.length > 0) {
      setMessages(history);
    } else {
      setMessages([]);
    }
  }, [history]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (msg) => {
        // Compare with normalized _id
        const currentUserId = user._id;
        const isFromFriend = msg.sender._id === friendId && msg.receiver === currentUserId;
        const isFromMe = msg.sender._id === currentUserId && msg.receiver === friendId;

        if (isFromFriend || isFromMe) {
          setMessages(prev => [...prev, msg]);
        }
      };

      socket.on("new-message", handleNewMessage);
      return () => socket.off("new-message", handleNewMessage);
    }
  }, [friendId, socket, user._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageData = {
      receiverId: friendId,
      content: inputText,
    };

    socket.emit("send-message", messageData);
    setInputText("");
  };

  const onStartCall = (type) => {
    if (!friend) return;
    const roomId = [user.id, friend._id].sort().join("-");
    setActiveCall({ roomId, friend, type });
  };

  if (!friend) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <div style={chatContainer}>
      {/* Chat Header */}
      <header className="glass" style={headerStyle}>
        <div style={userInfo}>
          <div style={avatarStyle}>{friend.username[0].toUpperCase()}</div>
          <div>
            <div style={userName}>{friend.username}</div>
            <div style={statusText}>{friend.online ? 'Active Now' : 'Offline'}</div>
          </div>
        </div>
        <div style={headerActions}>
          <button onClick={() => onStartCall('audio')} style={iconBtn}><Phone size={20} /></button>
          <button onClick={() => onStartCall('video')} style={iconBtnActive}><Video size={20} /></button>
          <button style={iconBtn}><MoreVertical size={20} /></button>
        </div>
      </header>

      {/* Messages Area */}
      <div style={messageList}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.sender._id === user.id;
            return (
              <motion.div
                key={msg._id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{
                  ...messageWrap,
                  justifyContent: isMe ? "flex-end" : "flex-start",
                }}
              >
                {!isMe && <div style={smallAvatar}>{friend.username[0].toUpperCase()}</div>}
                <div style={{
                  ...bubbleStyle,
                  background: isMe ? "var(--accent)" : "var(--bg)",
                  color: isMe ? "#fff" : "var(--text-h)",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  boxShadow: isMe ? "0 4px 12px rgba(170, 59, 255, 0.2)" : "0 2px 8px rgba(0,0,0,0.05)",
                }}>
                  {msg.content}
                  <div style={{...timeStyle, color: isMe ? "rgba(255,255,255,0.7)" : "var(--text)"}}>
                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer style={inputSection}>
        <form onSubmit={sendMessage} style={inputForm}>
          <button type="button" style={toolBtn}><Paperclip size={20} /></button>
          <button type="button" style={toolBtn}><Smile size={20} /></button>
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={chatInput}
          />
          <button type="submit" style={sendBtn}>
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};

// Styles
const chatContainer = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--code-bg)",
};

const headerStyle = {
  padding: "16px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--border)",
  zIndex: 5,
};

const userInfo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const avatarStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  background: "var(--accent-bg)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "18px",
};

const userName = {
  fontWeight: "700",
  fontSize: "16px",
};

const statusText = {
  fontSize: "13px",
  color: "#22c55e",
  fontWeight: "500",
};

const headerActions = {
  display: "flex",
  gap: "12px",
};

const iconBtn = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  cursor: "pointer",
};

const iconBtnActive = {
  ...iconBtn,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
};

const messageList = {
  flex: 1,
  overflowY: "auto",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const messageWrap = {
  display: "flex",
  alignItems: "flex-end",
  gap: "8px",
};

const smallAvatar = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "var(--border)",
  fontSize: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
};

const bubbleStyle = {
  maxWidth: "70%",
  padding: "12px 16px",
  fontSize: "15px",
  lineHeight: "1.5",
  position: "relative",
};

const timeStyle = {
  fontSize: "10px",
  marginTop: "4px",
  textAlign: "right",
};

const inputSection = {
  padding: "24px",
  background: "var(--bg)",
  borderTop: "1px solid var(--border)",
};

const inputForm = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "var(--code-bg)",
  padding: "8px",
  borderRadius: "16px",
  border: "1px solid var(--border)",
};

const chatInput = {
  flex: 1,
  background: "none",
  border: "none",
  padding: "10px",
  fontSize: "15px",
  color: "var(--text-h)",
  outline: "none",
};

const toolBtn = {
  background: "none",
  border: "none",
  color: "var(--text)",
  opacity: 0.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px",
};

const sendBtn = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 10px rgba(170, 59, 255, 0.3)",
};

export default ChatArea;
