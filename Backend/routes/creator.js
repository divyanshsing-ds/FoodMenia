const express = require("express");
const router = express.Router();
const Creator = require("../models/Creator");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

// ─── Follow / Unfollow Creator ──────────────────────────────
router.post("/:id/follow", authMiddleware, async (req, res) => {
    try {
        const creatorId = req.params.id;
        const userId = req.user.id;

        if (req.user.role !== "user") {
            return res.status(403).json({ success: false, message: "Only users can follow creators." });
        }

        const creator = await Creator.findById(creatorId);
        if (!creator) return res.status(404).json({ success: false, message: "Creator not found." });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const isFollowing = user.following.includes(creatorId);

        if (isFollowing) {
            // Unfollow
            user.following = user.following.filter(id => id.toString() !== creatorId);
            creator.followers = creator.followers.filter(id => id.toString() !== userId);
        } else {
            // Follow
            user.following.push(creatorId);
            creator.followers.push(userId);
        }

        await Promise.all([user.save(), creator.save()]);

        res.json({
            success: true,
            message: isFollowing ? "Unfollowed successfully." : "Followed successfully.",
            isFollowing: !isFollowing,
            followerCount: creator.followers.length
        });
    } catch (err) {
        console.error("Follow error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// ─── Get Creator's Followers (for Creator Dashboard) ──────────────────
router.get("/my/followers", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "creator") {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        const creator = await Creator.findById(req.user.id).populate("followers", "fullName email");
        if (!creator) return res.status(404).json({ success: false, message: "Creator not found." });

        res.json({ success: true, data: creator.followers });
    } catch (err) {
        console.error("Fetch followers error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
