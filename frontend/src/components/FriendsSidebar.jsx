import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, Check, X, User } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const FriendsSidebar = ({ friends, pendingRequests, onSelectFriend, selectedFriend, onRefresh }) => {
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/friends/search?q=${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendRequest = async (userId) => {
    try {
      await axios.post("http://localhost:5000/api/friends/request", { targetUserId: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Friend request sent!");
      setSearchResults(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      alert(err.response?.data?.message || "Error sending request");
    }
  };

  const respondRequest = async (fromUserId, accept) => {
    try {
      await axios.post("http://localhost:5000/api/friends/respond", { fromUserId, accept }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={sidebarStyle}>
      <div style={headerStyle}>
        <h2>Messages</h2>
        <div style={searchWrapper}>
          <Search size={18} style={searchIcon} />
          <input 
            type="text" 
            placeholder="Search friends..." 
            value={searchQuery}
            onChange={handleSearch}
            style={searchInput}
          />
        </div>
      </div>

      <div style={scrollArea}>
        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div style={sectionStyle}>
            <h3 style={sectionHeader}>Search Results</h3>
            {searchResults.length === 0 && !isSearching && <p style={emptyText}>No users found</p>}
            {searchResults.map(user => (
              <div key={user._id} style={userItem}>
                <div style={avatarStyle}>{user.username[0].toUpperCase()}</div>
                <div style={userInfo}>
                  <div style={userName}>{user.username}</div>
                </div>
                <button onClick={() => sendRequest(user._id)} style={actionBtn}>
                  <UserPlus size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div style={sectionStyle}>
            <h3 style={sectionHeader}>Pending Requests</h3>
            {pendingRequests.map(user => (
              <div key={user._id} style={userItem}>
                <div style={avatarStyle}>{user.username[0].toUpperCase()}</div>
                <div style={userInfo}>
                  <div style={userName}>{user.username}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => respondRequest(user._id, true)} style={acceptBtn}><Check size={16} /></button>
                  <button onClick={() => respondRequest(user._id, false)} style={rejectBtn}><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends List */}
        <div style={sectionStyle}>
          <h3 style={sectionHeader}>Active Friends</h3>
          {friends.length === 0 && <p style={emptyText}>No friends yet. Try searching for users!</p>}
          {friends.map(friend => (
            <motion.div 
              whileHover={{ x: 4 }}
              key={friend._id} 
              onClick={() => onSelectFriend(friend)}
              style={friend._id === selectedFriend?._id ? friendItemActive : friendItem}
            >
              <div style={avatarWrapper}>
                <div style={avatarStyle}>{friend.username[0].toUpperCase()}</div>
                {friend.online && <div style={onlineStatus}></div>}
              </div>
              <div style={userInfo}>
                <div style={userName}>{friend.username}</div>
                <div style={userSub}>{friend.online ? 'Online' : 'Offline'}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Styles
const sidebarStyle = {
  width: "320px",
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg)",
};

const headerStyle = {
  padding: "24px",
  borderBottom: "1px solid var(--border)",
};

const searchWrapper = {
  position: "relative",
  marginTop: "16px",
};

const searchIcon = {
  position: "absolute",
  left: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  opacity: 0.5,
};

const searchInput = {
  width: "100%",
  padding: "10px 10px 10px 38px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--social-bg)",
  fontSize: "14px",
  color: "var(--text-h)",
  boxSizing: "border-box",
};

const scrollArea = {
  flex: 1,
  overflowY: "auto",
  padding: "12px",
};

const sectionStyle = {
  marginBottom: "20px",
};

const sectionHeader = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "var(--text)",
  opacity: 0.6,
  marginBottom: "12px",
  marginLeft: "12px",
};

const userItem = {
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: "12px",
  marginBottom: "4px",
  gap: "12px",
};

const friendItem = {
  ...userItem,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const friendItemActive = {
  ...friendItem,
  background: "var(--accent-bg)",
  color: "var(--accent)",
};

const avatarWrapper = {
  position: "relative",
};

const avatarStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--accent-bg)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "16px",
};

const onlineStatus = {
  position: "absolute",
  bottom: "-2px",
  right: "-2px",
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  background: "#22c55e",
  border: "2px solid var(--bg)",
};

const userInfo = {
  flex: 1,
  minWidth: 0,
};

const userName = {
  fontWeight: "600",
  fontSize: "14px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const userSub = {
  fontSize: "12px",
  opacity: 0.6,
};

const actionBtn = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const acceptBtn = {
  ...actionBtn,
  background: "#22c55e",
};

const rejectBtn = {
  ...actionBtn,
  background: "#ef4444",
};

const emptyText = {
  fontSize: "13px",
  color: "var(--text)",
  textAlign: "center",
  marginTop: "10px",
  opacity: 0.7,
};

export default FriendsSidebar;
