import React from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, User as UserIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../api/apiInstance";
import { toast } from "sonner";

const FindFriends = () => {
  const queryClient = useQueryClient();

  // Fetch suggested users
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggestedUsers"],
    queryFn: async () => {
      const res = await apiInstance.get("/friends/suggested");
      return res.data;
    }
  });

  // Friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: (userId) => apiInstance.post("/friends/request", { targetUserId: userId }),
    onSuccess: () => {
      toast.success("Friend request sent!");
      // Refresh the suggestions and the pending list in the badge
      queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to send request");
    }
  });

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={titleStyle}
        >
          Discover People
        </motion.h1>
        <p style={subtitleStyle}>Find new friends and grow your network</p>
      </header>

      {isLoading ? (
        <div style={loadingStyle}>Loading suggestions...</div>
      ) : suggestions.length === 0 ? (
        <div style={emptyState}>
          <div style={emptyIcon}><UserIcon size={48} /></div>
          <h3>All caught up!</h3>
          <p>You've connected with everyone available for now.</p>
        </div>
      ) : (
        <div style={gridStyle}>
          {suggestions.map((person, idx) => (
            <motion.div
              key={person._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass"
              style={cardStyle}
            >
              <div style={avatarStyle}>
                {person.avatar ? (
                  <img src={person.avatar} alt={person.username} style={imgStyle} />
                ) : (
                  person.username[0].toUpperCase()
                )}
                {person.online && <div style={onlineIndicator}></div>}
              </div>
              <h3 style={userName}>{person.username}</h3>
              <p style={userEmail}>{person.email}</p>
              
              <button 
                onClick={() => sendRequestMutation.mutate(person._id)}
                disabled={sendRequestMutation.isPending}
                style={addBtn}
              >
                <UserPlus size={18} />
                <span>Add Friend</span>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// Styles
const pageStyle = {
  padding: "40px",
  height: "100%",
  overflowY: "auto",
};

const headerStyle = {
  marginBottom: "40px",
};

const titleStyle = {
  fontSize: "32px",
  fontWeight: "800",
  marginBottom: "8px",
};

const subtitleStyle = {
  color: "var(--text)",
  opacity: 0.6,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "24px",
};

const cardStyle = {
  padding: "24px",
  borderRadius: "24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  transition: "transform 0.2s ease",
};

const avatarStyle = {
  width: "80px",
  height: "80px",
  borderRadius: "28px",
  background: "var(--accent-bg)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "32px",
  fontWeight: "bold",
  marginBottom: "16px",
  position: "relative",
};

const onlineIndicator = {
  position: "absolute",
  bottom: "0",
  right: "0",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  background: "#22c55e",
  border: "3px solid var(--bg)",
};

const imgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "28px",
};

const userName = {
  fontSize: "18px",
  fontWeight: "700",
  marginBottom: "4px",
};

const userEmail = {
  fontSize: "14px",
  opacity: 0.5,
  marginBottom: "20px",
};

const addBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(170, 59, 255, 0.2)",
};

const loadingStyle = {
  textAlign: "center",
  padding: "40px",
  opacity: 0.6,
};

const emptyState = {
  textAlign: "center",
  padding: "80px 40px",
};

const emptyIcon = {
  width: "80px",
  height: "80px",
  background: "var(--accent-bg)",
  color: "var(--accent)",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
};

export default FindFriends;
