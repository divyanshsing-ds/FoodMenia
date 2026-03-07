const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Creator = require("../models/Creator");
const Video = require("../models/Video");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");

// ============================================================
//  HELPER: get or create a chat thread between operator & creator
// ============================================================
async function getOrCreateChat(operatorId, operatorName, creatorId, creatorName) {
    let chat = await Chat.findOne({ operatorId, creatorId });

    if (!chat) {
        chat = await Chat.create({
            operatorId,
            operatorName,
            creatorId,
            creatorName,
            messages: [],
        });
    }
    return chat;
}

// ============================================================
//  GET /api/chat/creators
//  Operator only — lists ALL creators with their stats (followers, views, likes, reels)
// ============================================================
router.get("/creators", authMiddleware, roleMiddleware("operator"), async (req, res) => {
    try {
        // Fetch all creators (public fields only)
        const creators = await Creator.find(
            {},
            "fullName profilePic creatorBio followers"
        ).lean();

        // Aggregate video stats per creator
        const videos = await Video.aggregate([
            {
                $group: {
                    _id: "$creatorId",
                    totalViews: { $sum: "$views" },
                    totalLikes: { $sum: { $size: "$likedBy" } },
                    reelCount: { $sum: 1 },
                },
            },
        ]);

        // Build a fast lookup map
        const statsMap = {};
        videos.forEach((v) => {
            statsMap[v._id.toString()] = {
                totalViews: v.totalViews,
                totalLikes: v.totalLikes,
                reelCount: v.reelCount,
            };
        });

        // Merge stats into creator list
        const result = creators.map((c) => {
            const stats = statsMap[c._id.toString()] || {
                totalViews: 0,
                totalLikes: 0,
                reelCount: 0,
            };
            return {
                _id: c._id,
                fullName: c.fullName,
                profilePic: c.profilePic,
                creatorBio: c.creatorBio,
                followerCount: c.followers?.length || 0,
                totalViews: stats.totalViews,
                totalLikes: stats.totalLikes,
                reelCount: stats.reelCount,
                // engagement score — higher = more interesting for collaboration
                engagementScore:
                    Math.round(
                        (stats.totalLikes / 100) * 40 +
                        (stats.totalViews / 1000) * 40 +
                        (c.followers?.length || 0) * 20
                    ),
            };
        });

        res.json({ success: true, data: result });
    } catch (err) {
        console.error("Fetch creators error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============================================================
//  GET /api/chat/my-chats
//  Operator OR Creator — list all their conversation threads
// ============================================================
router.get("/my-chats", authMiddleware, async (req, res) => {
    try {
        const { id, role } = req.user;
        let chats;

        if (role === "operator") {
            chats = await Chat.find({ operatorId: id })
                .populate("creatorId", "profilePic") // populating creator profile pic for operator
                .select("-messages") // exclude heavy message array for list view
                .sort({ updatedAt: -1 })
                .lean();
        } else if (role === "creator") {
            chats = await Chat.find({ creatorId: id })
                .select("-messages")
                .sort({ updatedAt: -1 })
                .lean();
        } else {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        res.json({ success: true, data: chats });
    } catch (err) {
        console.error("Fetch chats error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Alias for Creator: GET /api/chat/creator
router.get("/creator", authMiddleware, roleMiddleware("creator"), async (req, res) => {
    try {
        const chats = await Chat.find({ creatorId: req.user.id })
            .select("-messages")
            .sort({ updatedAt: -1 })
            .lean();
        res.json({ success: true, data: chats });
    } catch (err) {
        console.error("Fetch creator chats error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============================================================
//  GET /api/chat/:chatId
//  Operator OR Creator — get full chat thread (with messages)
//  Security: only participants can read the thread
// ============================================================
router.get("/:chatId", authMiddleware, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId)
            .populate("creatorId", "profilePic") // populate profile pic
            .lean();
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

        const { id, role } = req.user;
        const isParticipant =
            (role === "operator" && chat.operatorId.toString() === id) ||
            (role === "creator" && (chat.creatorId._id || chat.creatorId).toString() === id);

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        // Mark messages as read
        const update =
            role === "creator"
                ? { unreadByCreator: 0 }
                : { unreadByOperator: 0 };

        const updatedChat = await Chat.findByIdAndUpdate(req.params.chatId, update, { new: true });

        // Emit via Socket.io
        req.app.get("io").to(req.params.chatId).emit("chat_updated", updatedChat);

        res.json({ success: true, data: updatedChat });
    } catch (err) {
        console.error("Get chat error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============================================================
//  POST /api/chat/start/:creatorId
//  Operator only — initiates (or resumes) a chat with a creator
// ============================================================
router.post(
    "/start/:creatorId",
    authMiddleware,
    roleMiddleware("operator"),
    async (req, res) => {
        try {
            const operatorId = req.user.id;
            const operatorName = req.user.fullName;
            const { creatorId } = req.params;

            const creator = await Creator.findById(creatorId).select("fullName");
            if (!creator)
                return res.status(404).json({ success: false, message: "Creator not found." });

            const chat = await getOrCreateChat(
                operatorId,
                operatorName,
                creatorId,
                creator.fullName
            );

            // Emit via Socket.io to both participants that a chat has been started/accessed
            req.app.get("io").to(chat._id.toString()).emit("chat_started", chat);
            // Also emit to the operator's and creator's general channels for chat list updates
            req.app.get("io").to(`user-${operatorId}`).emit("chat_list_updated", chat);
            req.app.get("io").to(`user-${creatorId}`).emit("chat_list_updated", chat);


            res.json({ success: true, data: chat });
        } catch (err) {
            console.error("Start chat error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

// ============================================================
//  POST /api/chat/:chatId/message
//  Operator OR Creator — send a plain message
// ============================================================
router.post("/:chatId/message", authMiddleware, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

        const { id, role, fullName } = req.user;
        const isParticipant =
            (role === "operator" && chat.operatorId.toString() === id) ||
            (role === "creator" && (chat.creatorId._id || chat.creatorId).toString() === id);

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Message text is required." });
        }

        const newMessage = {
            senderId: id,
            senderRole: role,
            senderName: fullName,
            text: text.trim(),
            isOffer: false,
        };

        chat.messages.push(newMessage);

        // Increment unread for the other party
        if (role === "operator") chat.unreadByCreator += 1;
        else chat.unreadByOperator += 1;

        await chat.save();

        const saved = chat.messages[chat.messages.length - 1];

        // Emit via Socket.io
        req.app.get("io").to(req.params.chatId).emit("new_message", saved);
        req.app.get("io").to(req.params.chatId).emit("chat_updated", chat); // Also send full chat for unread counts

        res.json({ success: true, data: saved });
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Alias: POST /api/chat/message (Body must include chatId)
router.post("/message", authMiddleware, async (req, res) => {
    const { chatId, text } = req.body;
    if (!chatId) return res.status(400).json({ success: false, message: "chatId is required." });

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

        const { id, role, fullName } = req.user;
        const isParticipant =
            (role === "operator" && chat.operatorId.toString() === id) ||
            (role === "creator" && (chat.creatorId._id || chat.creatorId).toString() === id);

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Message text is required." });
        }

        const newMessage = {
            senderId: id,
            senderRole: role,
            senderName: fullName,
            text: text.trim(),
            isOffer: false,
        };

        chat.messages.push(newMessage);
        if (role === "operator") chat.unreadByCreator += 1;
        else chat.unreadByOperator += 1;

        await chat.save();
        const saved = chat.messages[chat.messages.length - 1];

        // Emit via Socket.io
        req.app.get("io").to(chatId).emit("new_message", saved);
        req.app.get("io").to(chatId).emit("chat_updated", chat); // Also send full chat for unread counts

        res.json({ success: true, data: saved });
    } catch (err) {
        console.error("Send aliased message error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============================================================
//  POST /api/chat/:chatId/offer
//  Operator only — send a collaboration offer message
// ============================================================
router.post(
    "/:chatId/offer",
    authMiddleware,
    roleMiddleware("operator"),
    async (req, res) => {
        try {
            const chat = await Chat.findById(req.params.chatId);
            if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

            const opId = (chat.operatorId._id || chat.operatorId).toString();
            if (opId !== req.user.id) {
                return res.status(403).json({ success: false, message: "Access denied." });
            }

            const { amount, text } = req.body;
            if (!amount || isNaN(amount) || Number(amount) <= 0) {
                return res
                    .status(400)
                    .json({ success: false, message: "A valid offer amount (₹) is required." });
            }

            const offerMessage = {
                senderId: req.user.id,
                senderRole: "operator",
                senderName: req.user.fullName,
                text: text?.trim() || `I'd like to offer ₹${amount} for a promotional reel for ${req.user.restaurantName || "my restaurant"}.`,
                isOffer: true,
                offerAmount: Number(amount),
                offerStatus: "pending",
            };

            chat.messages.push(offerMessage);
            chat.offerStatus = "pending";
            chat.latestOfferAmount = Number(amount);
            chat.unreadByCreator += 1;

            await chat.save();

            const saved = chat.messages[chat.messages.length - 1];

            // Emit via Socket.io
            req.app.get("io").to(req.params.chatId).emit("new_message", saved);
            req.app.get("io").to(req.params.chatId).emit("chat_updated", chat); // Also send full chat for unread counts

            res.json({ success: true, data: saved });
        } catch (err) {
            console.error("Send offer error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

// ============================================================
//  PATCH /api/chat/:chatId/offer/:messageId
//  Creator only — accept, reject, or counter-negotiate an offer
// ============================================================
router.patch(
    "/:chatId/offer/:messageId",
    authMiddleware,
    async (req, res) => {
        try {
            const { id, role, fullName } = req.user;
            const chat = await Chat.findById(req.params.chatId);
            if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

            const opId = (chat.operatorId._id || chat.operatorId).toString();
            const crId = (chat.creatorId._id || chat.creatorId).toString();

            const isParticipant =
                (role === "operator" && opId === id) ||
                (role === "creator" && crId === id);

            if (!isParticipant) {
                return res.status(403).json({ success: false, message: "Access denied." });
            }

            const message = chat.messages.id(req.params.messageId);
            if (!message || !message.isOffer) {
                return res.status(404).json({ success: false, message: "Offer message not found." });
            }

            // Important: You can only respond to an offer sent by the OTHER person
            if (message.senderId.toString() === id) {
                return res.status(400).json({ success: false, message: "You cannot respond to your own offer." });
            }

            const { action, counterAmount } = req.body;
            // action: "accept" | "reject" | "negotiate"

            if (!["accept", "reject", "negotiate"].includes(action)) {
                return res.status(400).json({ success: false, message: "Invalid action." });
            }

            if (action === "negotiate" && (!counterAmount || isNaN(counterAmount))) {
                return res.status(400).json({ success: false, message: "Counter amount is required for negotiation." });
            }

            const statusMap = {
                accept: "accepted",
                reject: "rejected",
                negotiate: "negotiating",
            };

            message.offerStatus = statusMap[action];
            chat.offerStatus = statusMap[action];

            let replyText = "";
            if (action === "accept") {
                replyText = `✅ I've accepted your offer of ₹${message.offerAmount}! Let's get started.`;
            } else if (action === "reject") {
                replyText = `❌ I'm unable to accept this offer at the moment. Thank you for reaching out!`;
            } else {
                replyText = `🤝 I'd like to counter with ₹${counterAmount}. What do you think?`;
            }

            // Latest price update on chat
            if (action === "negotiate") {
                chat.latestOfferAmount = Number(counterAmount);
            } else if (action === "accept") {
                chat.latestOfferAmount = message.offerAmount;
            }

            // Sync unread counts
            if (role === "operator") chat.unreadByCreator += 1;
            else chat.unreadByOperator += 1;

            // Auto-add the reply message
            chat.messages.push({
                senderId: id,
                senderRole: role,
                senderName: fullName,
                text: replyText,
                isOffer: action === "negotiate",
                offerAmount: action === "negotiate" ? Number(counterAmount) : null,
                offerStatus: action === "negotiate" ? "pending" : statusMap[action],
            });

            await chat.save();

            // Emit via Socket.io (broadcast the updated chat state)
            req.app.get("io").to(req.params.chatId).emit("offer_updated", chat);

            res.json({ success: true, data: chat });
        } catch (err) {
            console.error("Offer response error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

module.exports = router;
