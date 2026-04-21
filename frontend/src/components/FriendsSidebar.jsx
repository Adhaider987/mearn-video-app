import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, Check, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../api/apiInstance";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const FriendsSidebar = () => {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Friends List
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/list");
      return res.data;
    },
  });

  // Fetch Pending Requests
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/pending");
      return res.data;
    },
  });

  // Search Mutation
  const { data: searchResults = [], mutate: searchUsers, isPending: isSearching } = useMutation({
    mutationFn: async (q) => {
      const res = await apiInstance.get(`/friends/search?q=${q}`);
      return res.data;
    },
  });

  // Friend Request Mutation
  const sendRequestMutation = useMutation({
    mutationFn: (userId) => apiInstance.post("/friends/request", { targetUserId: userId }),
    onSuccess: () => {
      toast.success("Friend request sent!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Error sending request"),
  });

  // Respond Mutation
  const respondMutation = useMutation({
    mutationFn: ({ fromUserId, accept }) => apiInstance.post("/friends/respond", { fromUserId, accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
      toast.success("Response sent");
    },
  });

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length >= 2) searchUsers(q);
  };

  return (
    <div className="flex-1 min-w-0 border-r border-white/5 flex flex-col bg-premium-bg">
      <div className="p-6 border-b border-white/5">
        <h2 className="text-lg font-bold text-premium-text-h">Messages</h2>
        <div className="relative mt-4 group">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-premium-text opacity-40 group-focus-within:opacity-100 transition-opacity" />
          <input 
            type="text" 
            placeholder="Search friends..." 
            value={searchQuery}
            onChange={handleSearch}
            className="w-full py-2.5 pl-11 pr-4 rounded-xl border border-white/5 bg-white/5 text-sm text-premium-text-h focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5 no-scrollbar">
        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <h3 className="text-[11px] uppercase tracking-wider text-premium-text opacity-50 mb-3 ml-3 font-semibold">Search Results</h3>
            {searchResults.length === 0 && !isSearching && <p className="text-xs text-center text-premium-text py-4 opacity-70">No users found</p>}
            <div className="space-y-1">
              {searchResults.map(user => (
                <div key={user._id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-premium-accent/10 border border-premium-accent/20 flex items-center justify-center text-premium-accent font-bold uppercase">
                    {user.username[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate text-premium-text-h">{user.username}</div>
                  </div>
                  <button 
                    onClick={() => sendRequestMutation.mutate(user._id)} 
                    className="p-2 bg-premium-accent text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 shadow-md shadow-premium-accent/20"
                  >
                    <UserPlus size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-premium-text opacity-50 mb-3 ml-3 font-semibold">Pending Requests</h3>
            <div className="space-y-1">
              {pendingRequests.map(user => (
                <div key={user._id} className="flex items-center gap-3 p-3 rounded-2xl bg-premium-accent/[0.03] border border-premium-accent/5">
                  <div className="w-10 h-10 rounded-xl bg-premium-accent/10 border border-premium-accent/20 flex items-center justify-center text-premium-accent font-bold uppercase">
                    {user.username[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate text-premium-text-h">{user.username}</div>
                  </div>
                  <div className="flex gap-1.5 font-sans">
                    <button onClick={() => respondMutation.mutate({ fromUserId: user._id, accept: true })} className="p-2 bg-green-500 text-white rounded-lg hover:scale-110 transition-transform"><Check size={16} /></button>
                    <button onClick={() => respondMutation.mutate({ fromUserId: user._id, accept: false })} className="p-2 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"><X size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-premium-text opacity-50 mb-3 ml-3 font-semibold">Conversations</h3>
          {friends.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-xs text-premium-text leading-relaxed opacity-60">No friends yet.<br/>Try searching for users to start chatting!</p>
            </div>
          )}
          <div className="space-y-1 font-sans">
            {friends.map(friend => (
              <motion.div 
                whileHover={{ x: 4 }}
                key={friend._id} 
                onClick={() => navigate(`/dashboard/chat/${friend._id}`)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group ${
                  friend._id === friendId 
                    ? "bg-premium-accent/10 border border-premium-accent/20" 
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="relative">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base transition-all uppercase ${
                    friend._id === friendId ? "bg-premium-accent text-white" : "bg-premium-accent/10 text-premium-accent border border-premium-accent/20"
                  }`}>
                    {friend.username[0]}
                  </div>
                  {friend.online && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-premium-bg"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm truncate transition-colors ${friend._id === friendId ? "text-premium-accent" : "text-premium-text-h group-hover:text-premium-accent"}`}>
                    {friend.username}
                  </div>
                  <div className="text-[11px] opacity-50 truncate">
                    {friend.online ? 'Online now' : 'Offline'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsSidebar;
