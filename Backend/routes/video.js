const express = require("express");
const router = express.Router();
const Video = require("../models/Video");
const { authMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");

// =====================================================
//  FETCH ALL VIDEOS (Feed)
//  /api/video/feed
// =====================================================
router.get("/feed", async (req, res) => {
    try {
        const videos = await Video.find()
            .populate("restaurantId", "restaurantName restaurantLocation")
            .populate("creatorId", "fullName")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: videos });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
//  FETCH CREATOR VIDEOS (My Videos)
//  /api/video/my
// =====================================================
router.get("/my", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "creator") {
            return res.status(403).json({ success: false, message: "Only creators can view their reels" });
        }

        const videos = await Video.find({ creatorId: req.user.id })
            .populate("restaurantId", "restaurantName")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: videos });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
//  UPLOAD VIDEO
//  /api/video/upload
// =====================================================
router.post("/upload", authMiddleware, upload.single("video"), async (req, res) => {
    try {
        if (req.user.role !== "creator") {
            return res.status(403).json({ success: false, message: "Only creators can upload reels" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No video file provided" });
        }

        const { title, description, restaurantId } = req.body;

        if (!title || !restaurantId) {
            return res.status(400).json({ success: false, message: "Title and Restaurant are required" });
        }

        const newVideo = new Video({
            title,
            description,
            videoUrl: `/uploads/reels/${req.file.filename}`,
            creatorId: req.user.id,
            restaurantId,
        });

        await newVideo.save();

        res.status(201).json({ success: true, data: newVideo });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// UPDATE VIDEO (title / description)
router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        if (video.creatorId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const { title, description } = req.body;
        if (title) video.title = title;
        if (description !== undefined) video.description = description;

        await video.save();
        res.json({ success: true, data: video });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE VIDEO
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        if (video.creatorId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await Video.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Video deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// LIKE/UNLIKE VIDEO
router.post("/:id/like", authMiddleware, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        const userId = req.user.id;
        const index = video.likedBy.findIndex(id => id.toString() === userId);

        if (index === -1) {
            // Like
            video.likedBy.push(userId);
        } else {
            // Unlike
            video.likedBy.splice(index, 1);
        }

        await video.save();
        res.json({ success: true, likes: video.likedBy.length, liked: index === -1 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ADD COMMENT
router.post("/:id/comment", authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });

        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        video.comments.push({
            userId: req.user.id,
            userName: req.user.fullName,
            text,
        });

        await video.save();
        res.json({ success: true, data: video.comments[video.comments.length - 1] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// INCREMENT VIEW COUNT
router.post("/:id/view", async (req, res) => {
    try {
        const video = await Video.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        );
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });
        res.json({ success: true, views: video.views });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// LIKE/UNLIKE COMMENT
router.post("/:id/comment/:commentId/like", authMiddleware, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        const comment = video.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        const userId = req.user.id;
        const index = comment.likedBy.findIndex(id => id.toString() === userId);

        if (index === -1) {
            comment.likedBy.push(userId);
        } else {
            comment.likedBy.splice(index, 1);
        }

        await video.save();
        res.json({ success: true, likes: comment.likedBy.length, liked: index === -1 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// REPLY TO COMMENT
router.post("/:id/comment/:commentId/reply", authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Reply text is required" });

        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        const comment = video.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        comment.replies.push({
            userId: req.user.id,
            userName: req.user.fullName,
            text,
        });

        await video.save();
        res.json({ success: true, data: comment.replies[comment.replies.length - 1] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE COMMENT (Creator only or comment owner)
router.delete("/:id/comment/:commentId", authMiddleware, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        const comment = video.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        // Authorization: logic
        // 1. If requester is the creator of the video
        // 2. If requester is the owner of the comment
        const isVideoCreator = video.creatorId.toString() === req.user.id;
        const isCommentOwner = comment.userId.toString() === req.user.id;

        if (!isVideoCreator && !isCommentOwner) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this comment" });
        }

        video.comments.pull(req.params.commentId);
        await video.save();

        res.json({ success: true, message: "Comment deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
