const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Middleware to verify JWT
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new Error();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

// Search users
router.get("/search", auth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    
    // Find users by username or email, excluding self
    const users = await User.find({
      $and: [
        { _id: { $ne: req.userId } },
        {
          $or: [
            { username: { $regex: query, $options: "i" } },
            { email: { $regex: query, $options: "i" } },
          ],
        },
      ],
    }).select("username email avatar online");
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send friend request
router.post("/request", auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (targetUserId === req.userId) return res.status(400).json({ message: "Cannot friend yourself" });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (targetUser.friendRequests.includes(req.userId) || targetUser.friends.includes(req.userId)) {
      return res.status(400).json({ message: "Request already sent or already friends" });
    }

    targetUser.friendRequests.push(req.userId);
    await targetUser.save();

    res.json({ message: "Friend request sent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accept or Reject friend request
router.post("/respond", auth, async (req, res) => {
  try {
    const { fromUserId, accept } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user.friendRequests.includes(fromUserId)) {
      return res.status(400).json({ message: "No such friend request" });
    }

    // Remove from requests
    user.friendRequests = user.friendRequests.filter(id => id.toString() !== fromUserId);

    if (accept) {
      user.friends.push(fromUserId);
      await user.save();
      
      // Also add self to the other user's friend list
      await User.findByIdAndUpdate(fromUserId, { $push: { friends: req.userId } });
      res.json({ message: "Friend request accepted" });
    } else {
      await user.save();
      res.json({ message: "Friend request rejected" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get friends list
router.get("/list", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("friends", "username email avatar online lastSeen");
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending requests
router.get("/pending", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("friendRequests", "username email avatar");
    res.json(user.friendRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
