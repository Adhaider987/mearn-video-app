import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, Phone, MoreVertical, Smile, Paperclip, ArrowLeft } from "lucide-react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../api/apiInstance";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const ChatArea = () => {
  const { friendId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const { setActiveCall } = useOutletContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  // Fetch Friend Details
  const { data: friends = [] } = useQuery({ 
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/list");
      return res.data;
    }
  });
  const friend = friends.find(f => f._id?.toString() === friendId || f.id?.toString() === friendId);

  // Fetch Message History
  const { data: history = [] } = useQuery({
    queryKey: ["messages", friendId],
    queryFn: async () => {
      const res = await apiInstance.get(`/messages/${friendId}`);
      return res.data;
    },
    enabled: !!friendId,
  });

  useEffect(() => {
    setMessages(history || []);
  }, [history]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (msg) => {
        const currentUserId = user._id;
        const isFromFriend = msg.sender._id === friendId && msg.receiver === currentUserId;
        const isFromMe = msg.sender._id === currentUserId && msg.receiver === friendId;

        if (isFromFriend || isFromMe) {
          setMessages(prev => {
            if (msg._id && prev.find(m => m._id === msg._id)) return prev;
            return [...prev, msg].sort((a, b) => new Date(a.createdAt || Date.now()) - new Date(b.createdAt || Date.now()));
          });
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
    socket.emit("send-message", { receiverId: friendId, content: inputText });
    setInputText("");
  };

  const onStartCall = (type) => {
    if (!friend) return;
    const roomId = [user._id, friend._id].sort().join("-");
    setActiveCall({ roomId, friend, type, isIncoming: false });
  };

  if (!friend) return <div className="flex-1 flex items-center justify-center text-premium-text">Selecting a chat...</div>;

  return (
    <div className="flex flex-col h-full bg-premium-bg-alt">
      {/* Chat Header */}
      <header className="glass px-6 py-4 flex items-center justify-between border-b border-white/5 z-[5]">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate("/dashboard/chat")} 
            className="md:hidden p-2 hover:bg-white/5 rounded-full transition-colors mr-2"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-premium-accent/10 text-premium-accent flex items-center justify-center font-bold text-lg uppercase border border-premium-accent/20">
            {friend.username[0]}
          </div>
          <div>
            <div className="font-bold text-base text-premium-text-h">{friend.username}</div>
            <div className={`text-xs font-medium ${friend.online ? 'text-green-500' : 'text-premium-text opacity-60'}`}>
              {friend.online ? 'Active Now' : 'Offline'}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onStartCall('audio')} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-premium-text hover:bg-white/15 transition-all">
            <Phone size={20} />
          </button>
          <button onClick={() => onStartCall('video')} className="w-10 h-10 rounded-xl flex items-center justify-center bg-premium-accent text-white shadow-lg shadow-premium-accent/20 hover:scale-105 active:scale-95 transition-all">
            <Video size={20} />
          </button>
          <button className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-premium-text">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.sender._id === user._id;
            return (
              <motion.div
                key={msg._id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-lg bg-premium-accent/20 text-premium-accent text-[10px] flex items-center justify-center font-bold uppercase transition-transform hover:scale-110 cursor-pointer">
                    {friend.username[0]}
                  </div>
                )}
                <div className={`max-w-[70%] p-4 text-sm leading-6 relative ${
                  isMe 
                    ? 'bg-premium-accent text-white rounded-[18px_18px_4px_18px] shadow-lg shadow-premium-accent/20' 
                    : 'bg-white/5 text-premium-text-h rounded-[18px_18px_18px_4px] border border-white/5 shadow-sm'
                }`}>
                  {msg.content}
                  <div className={`text-[10px] mt-1 text-right opacity-60`}>
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
      <footer className="p-6 bg-premium-bg border-t border-white/5">
        <form onSubmit={sendMessage} className="flex items-center gap-3 bg-premium-bg-alt p-2 rounded-2xl border border-white/10 shadow-inner">
          <button type="button" className="p-2 text-premium-text opacity-40 hover:opacity-100 transition-opacity"><Paperclip size={20} /></button>
          <button type="button" className="p-2 text-premium-text opacity-40 hover:opacity-100 transition-opacity"><Smile size={20} /></button>
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent border-none text-sm text-premium-text-h outline-none placeholder:text-premium-text/30"
          />
          <button type="submit" className="w-11 h-11 rounded-xl bg-premium-accent text-white flex items-center justify-center shadow-lg shadow-premium-accent/30 hover:scale-105 active:scale-95 transition-all">
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatArea;
