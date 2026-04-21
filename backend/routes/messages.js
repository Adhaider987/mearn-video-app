const express = require("express");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
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

// Get message history with a specific friend
router.get("/:friendId", auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: req.params.friendId },
        { sender: req.params.friendId, receiver: req.userId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate("sender", "username avatar")
    .limit(50);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
