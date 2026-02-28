import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/creator.css";
import CONFIG from "../utils/config";
import { generateReelDescription } from "../utils/gemini";

export default function CreatorDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("my-reels");
    const [reels, setReels] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [profilePic, setProfilePic] = useState(null);
    const [generatingDesc, setGeneratingDesc] = useState(false);
    const [creatorBio, setCreatorBio] = useState("");
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState("");
    const [replyTo, setReplyTo] = useState(null); // { reelId, commentId, userName }
    const [newReply, setNewReply] = useState("");
    const [restSearch, setRestSearch] = useState("");
    const [showRestList, setShowRestList] = useState(false);
    const profilePicRef = useRef(null);

    // Upload form
    const [formData, setFormData] = useState({ title: "", description: "", restaurantId: "" });
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);

    // Edit modal
    const [editReel, setEditReel] = useState(null); // { _id, title, description }
    const [editSaving, setEditSaving] = useState(false);

    const user = JSON.parse(localStorage.getItem(CONFIG.dataKey("creator")) || "{}");
    const token = localStorage.getItem(CONFIG.tokenKey("creator"));

    // Dynamic key for persistent profile pic per user
    const picKey = `creatorProfilePic_${user.id || 'anonymous'}`;

    useEffect(() => {
        const saved = localStorage.getItem(picKey);
        if (saved) setProfilePic(saved);
    }, [picKey]);

    useEffect(() => {
        setCreatorBio(user.creatorBio || "");
        fetchMyReels();
        fetchRestaurants();
    }, []);

    // ─── Session Protection ───
    useEffect(() => {
        if (!token || user.role !== "creator") {
            navigate("/");
        }
    }, [token, user.role, navigate]);



    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest(".cd-search-wrap")) {
                setShowRestList(false);
            }
        };
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    const fetchMyReels = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/my`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setReels(data.data);
        } catch { console.error("Failed to fetch reels"); }
        finally { setLoading(false); }
    };

    const fetchRestaurants = async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/operators`);
            const data = await res.json();
            if (data.success) setRestaurants(data.data);
        } catch { console.error("Failed to fetch restaurants"); }
    };

    const handleGenerateDesc = async (isEdit = false) => {
        const title = isEdit ? editReel.title : formData.title;
        if (!title.trim()) return alert("Please enter a reel title first");
        setGeneratingDesc(true);
        try {
            const desc = await generateReelDescription(title);
            if (isEdit) {
                setEditReel(prev => ({ ...prev, description: desc }));
            } else {
                setFormData(prev => ({ ...prev, description: desc }));
            }
        } catch {
            alert("AI generation failed. Please try again.");
        } finally {
            setGeneratingDesc(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) { setVideoFile(file); setVideoPreview(URL.createObjectURL(file)); }
    };

    const handleProfilePicChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setProfilePic(ev.target.result);
            localStorage.setItem(picKey, ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!videoFile) return alert("Please select a video");
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("title", formData.title);
            fd.append("description", formData.description);
            fd.append("restaurantId", formData.restaurantId);
            fd.append("video", videoFile);
            const res = await fetch(`${CONFIG.API_BASE}/video/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (data.success) {
                setFormData({ title: "", description: "", restaurantId: "" });
                setRestSearch("");
                setVideoFile(null); setVideoPreview(null); setShowUploadForm(false);
                fetchMyReels();
            } else alert(data.message);
        } catch { alert("Upload failed"); }
        finally { setUploading(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this reel?")) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setReels(reels.filter(r => r._id !== id));
        } catch { alert("Delete failed"); }
    };

    const handleEditSave = async () => {
        if (!editReel.title.trim()) return alert("Title is required");
        setEditSaving(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${editReel._id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ title: editReel.title, description: editReel.description }),
            });
            const data = await res.json();
            if (data.success) {
                setReels(reels.map(r => r._id === editReel._id ? { ...r, title: editReel.title, description: editReel.description } : r));
                setEditReel(null);
            } else alert(data.message);
        } catch { alert("Edit failed"); }
        finally { setEditSaving(false); }
    };

    const handleUpdateBio = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/profile`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ creatorBio: tempBio }),
            });
            const data = await res.json();
            if (data.success) {
                setCreatorBio(data.data.creatorBio);
                const updatedUser = { ...user, creatorBio: data.data.creatorBio };
                localStorage.setItem(CONFIG.dataKey("creator"), JSON.stringify(updatedUser));
                setIsEditingBio(false);
            } else {
                alert(data.message);
            }
        } catch {
            alert("Failed to update bio");
        } finally {
            setLoading(false);
        }
    };

    const handleLikeComment = async (reelId, commentId) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${reelId}/comment/${commentId}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setReels(prev => prev.map(r =>
                    r._id === reelId
                        ? {
                            ...r,
                            comments: r.comments.map(c =>
                                c._id === commentId
                                    ? {
                                        ...c,
                                        likedBy: data.liked
                                            ? [...new Set([...(c.likedBy || []), user.id])]
                                            : (c.likedBy || []).filter(id => id !== user.id)
                                    }
                                    : c
                            )
                        } : r
                ));
            }
        } catch { alert("Like failed"); }
    };

    const handleReplyComment = async () => {
        if (!newReply.trim()) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${replyTo.reelId}/comment/${replyTo.commentId}/reply`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: newReply })
            });
            const data = await res.json();
            if (data.success) {
                setReels(prev => prev.map(r =>
                    r._id === replyTo.reelId
                        ? {
                            ...r,
                            comments: r.comments.map(c =>
                                c._id === replyTo.commentId
                                    ? { ...c, replies: [...(c.replies || []), data.data] }
                                    : c
                            )
                        } : r
                ));
                setNewReply("");
                setReplyTo(null);
            }
        } catch { alert("Reply failed"); }
    };

    const handleDeleteComment = async (reelId, commentId) => {
        if (!window.confirm("Delete this comment?")) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${reelId}/comment/${commentId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setReels(prev => prev.map(r =>
                    r._id === reelId
                        ? { ...r, comments: r.comments.filter(c => c._id !== commentId) }
                        : r
                ));
            }
        } catch { alert("Delete failed"); }
    };

    const videoUrl = (url) => url.startsWith("http") ? url : `${CONFIG.UPLOADS_BASE}${url}`;

    // ── Analytics totals ──
    const totalLikes = reels.reduce((s, r) => s + (r.likedBy?.length || 0), 0);
    const totalComments = reels.reduce((s, r) => s + (r.comments?.length || 0), 0);
    const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0);
    const totalEarnings = ((totalViews / 20) * 0.012) + ((totalLikes / 100) * 0.012);

    return (
        <div className="cd-layout">

            {/* ── SIDEBAR ── */}
            <aside className="cd-sidebar">
                <div className="cd-brand">🍕 FoodMenia</div>

                <div className="cd-profile">
                    <div className="cd-avatar-wrap" onClick={() => profilePicRef.current.click()} title="Change profile picture">
                        {profilePic
                            ? <img src={profilePic} alt="Profile" className="cd-avatar-img" />
                            : <div className="cd-avatar-fallback">🍳</div>}
                        <div className="cd-avatar-hover"><span>📷</span></div>
                    </div>
                    <input type="file" accept="image/*" ref={profilePicRef} hidden onChange={handleProfilePicChange} />
                    <p className="cd-user-name">{user.fullName}</p>
                    <span className="cd-user-badge">Creator</span>

                    <div className="cd-bio-container">
                        {isEditingBio ? (
                            <div className="cd-bio-edit-area">
                                <textarea
                                    className="cd-bio-textarea"
                                    value={tempBio}
                                    onChange={(e) => setTempBio(e.target.value)}
                                    placeholder="Write your culinary journey..."
                                />
                                <div className="cd-bio-btns">
                                    <button className="cd-btn-bio-save" onClick={handleUpdateBio} disabled={loading}>
                                        {loading ? "..." : "Save"}
                                    </button>
                                    <button className="cd-btn-bio-cancel" onClick={() => setIsEditingBio(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p
                                className="cd-user-bio"
                                onClick={() => {
                                    setTempBio(creatorBio);
                                    setIsEditingBio(true);
                                }}
                                title="Click to edit bio"
                            >
                                {creatorBio || "No bio yet. Click to add one!"}
                            </p>
                        )}
                    </div>
                </div>

                <nav className="cd-nav">
                    <button className={`cd-nav-btn ${activeTab === "my-reels" ? "active" : ""}`} onClick={() => setActiveTab("my-reels")}>
                        <span>🎬</span> My Reels
                    </button>
                    <button className={`cd-nav-btn ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>
                        <span>📊</span> Analytics
                    </button>
                </nav>

                <button className="cd-logout" onClick={() => {
                    localStorage.removeItem(CONFIG.tokenKey("creator"));
                    localStorage.removeItem(CONFIG.dataKey("creator"));
                    // We DO NOT remove the picKey here, so it persists when they log back in
                    navigate("/");
                }}>
                    <span>🚪</span> Logout
                </button>
            </aside>

            {/* ── MAIN ── */}
            <main className="cd-main">
                <header className="cd-topbar">
                    <div className="cd-welcome">Welcome back, <strong>{user.fullName?.split(" ")[0]}</strong> 👋</div>
                    <div className="cd-topbar-right">
                        <span className="cd-reel-count">{reels.length} Reel{reels.length !== 1 ? "s" : ""}</span>
                    </div>
                </header>

                <div className="cd-content">

                    {/* ── MY REELS TAB ── */}
                    {activeTab === "my-reels" && (
                        <>
                            <div className="cd-section-head">
                                <h2 className="cd-section-title">Your Culinary Reels</h2>
                                <button className="cd-btn-upload" onClick={() => setShowUploadForm(v => !v)}>
                                    {showUploadForm ? "✕ Cancel" : "＋ New Reel"}
                                </button>
                            </div>

                            {/* upload form */}
                            {showUploadForm && (
                                <form className="cd-upload-form" onSubmit={handleUpload}>
                                    <p className="cd-form-title">🎬 Share Your Culinary Story</p>
                                    <div className="cd-form-row">
                                        <div className="cd-field cd-field-full">
                                            <label className="cd-label">Video File (MP4 / MOV) *</label>
                                            <div className="cd-dropzone">
                                                <input type="file" accept="video/*" className="cd-file-input" onChange={handleFileChange} required />
                                                {videoPreview
                                                    ? <video src={videoPreview} className="cd-video-preview" controls />
                                                    : <div className="cd-drop-placeholder"><div className="cd-drop-icon">📹</div><p>Click or drag a video here</p></div>}
                                            </div>
                                        </div>
                                        <div className="cd-field">
                                            <label className="cd-label">Reel Title *</label>
                                            <input className="cd-input" type="text" placeholder="e.g. Most Amazing Butter Chicken"
                                                value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                        </div>
                                        <div className="cd-field">
                                            <label className="cd-label">Associated Restaurant *</label>
                                            <div className="cd-search-wrap">
                                                <input
                                                    className="cd-input"
                                                    type="text"
                                                    placeholder="Search Restaurant..."
                                                    value={restSearch}
                                                    onFocus={() => setShowRestList(true)}
                                                    onChange={e => {
                                                        setRestSearch(e.target.value);
                                                        setShowRestList(true);
                                                    }}
                                                    required={!formData.restaurantId}
                                                />
                                                {showRestList && (
                                                    <div className="cd-search-results">
                                                        {restaurants
                                                            .filter(r => r.restaurantName.toLowerCase().includes(restSearch.toLowerCase()))
                                                            .map(r => (
                                                                <div
                                                                    key={r._id}
                                                                    className="cd-search-item"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, restaurantId: r._id });
                                                                        setRestSearch(r.restaurantName);
                                                                        setShowRestList(false);
                                                                    }}
                                                                >
                                                                    {r.restaurantName}
                                                                </div>
                                                            ))
                                                        }
                                                        {restaurants.filter(r => r.restaurantName.toLowerCase().includes(restSearch.toLowerCase())).length === 0 && (
                                                            <div className="cd-search-no-results">No restaurants found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="cd-field cd-field-full">
                                            <div className="cd-label-row">
                                                <label className="cd-label">Description</label>
                                                <button type="button" className="cd-btn-ai" onClick={handleGenerateDesc} disabled={generatingDesc}>
                                                    {generatingDesc ? <span className="cd-ai-spinner">⏳</span> : "✨"} {generatingDesc ? "Generating…" : "AI Generate"}
                                                </button>
                                            </div>
                                            <textarea className="cd-input cd-textarea" placeholder="Tell your audience about this food… or click ✨ to auto-generate!"
                                                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                    </div>
                                    <button type="submit" className="cd-btn-publish" disabled={uploading}>
                                        {uploading ? "Uploading…" : "🚀 Publish Reel"}
                                    </button>
                                </form>
                            )}

                            {/* reels grid */}
                            {loading ? (
                                <div className="cd-loading">Loading your reels…</div>
                            ) : reels.length > 0 ? (
                                <div className="cd-grid">
                                    {reels.map((reel) => (
                                        <div className="cd-card" key={reel._id}>
                                            <video className="cd-card-video" src={videoUrl(reel.videoUrl)} />
                                            <div className="cd-card-body">
                                                <p className="cd-card-title">{reel.title}</p>
                                                <p className="cd-card-restaurant">🏪 {reel.restaurantId?.restaurantName}</p>
                                                {reel.description && <p className="cd-card-desc">{reel.description}</p>}
                                                <div className="cd-card-footer">
                                                    <div className="cd-stats">
                                                        <span className="cd-stat">❤️ {reel.likedBy?.length || 0}</span>
                                                        <span className="cd-stat">💬 {reel.comments?.length || 0}</span>
                                                        <span className="cd-stat">👁️ {reel.views || 0}</span>
                                                    </div>
                                                    <div className="cd-card-actions">
                                                        <button className="cd-btn-edit" onClick={() => setEditReel({ _id: reel._id, title: reel.title, description: reel.description || "" })}>✏️</button>
                                                        <button className="cd-btn-delete" onClick={() => handleDelete(reel._id)}>🗑️</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="cd-empty">
                                    <div className="cd-empty-icon">🎬</div>
                                    <p className="cd-empty-title">No reels yet</p>
                                    <p className="cd-empty-sub">Upload your first culinary reel to get started!</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── ANALYTICS TAB ── */}
                    {activeTab === "analytics" && (
                        <>
                            <div className="cd-section-head">
                                <h2 className="cd-section-title">Analytics</h2>
                            </div>

                            {/* summary cards */}
                            <div className="cd-analytics-summary">
                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon">🎬</div>
                                    <div className="cd-stat-val">{reels.length}</div>
                                    <div className="cd-stat-label">Total Reels</div>
                                </div>
                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon">👁️</div>
                                    <div className="cd-stat-val">{totalViews.toLocaleString()}</div>
                                    <div className="cd-stat-label">Total Views</div>
                                </div>
                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon">❤️</div>
                                    <div className="cd-stat-val">{totalLikes.toLocaleString()}</div>
                                    <div className="cd-stat-label">Total Likes</div>
                                </div>
                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon">💬</div>
                                    <div className="cd-stat-val">{totalComments.toLocaleString()}</div>
                                    <div className="cd-stat-label">Total Comments</div>
                                </div>
                                <div className="cd-stat-card cd-stat-money">
                                    <div className="cd-stat-icon">💰</div>
                                    <div className="cd-stat-val">${totalEarnings.toFixed(3)}</div>
                                    <div className="cd-stat-label">Estimated Revenue</div>
                                </div>
                            </div>

                            {/* per-reel breakdown */}
                            <h3 className="cd-analytics-sub">Per Reel Breakdown</h3>
                            {reels.length === 0 ? (
                                <div className="cd-empty">
                                    <div className="cd-empty-icon">📊</div>
                                    <p className="cd-empty-title">No data yet</p>
                                    <p className="cd-empty-sub">Upload some reels to start seeing analytics.</p>
                                </div>
                            ) : (
                                <div className="cd-analytics-list">
                                    {reels.map(reel => (
                                        <div className="cd-analytics-row" key={reel._id}>
                                            <video className="cd-analytics-thumb" src={videoUrl(reel.videoUrl)} />
                                            <div className="cd-analytics-info">
                                                <p className="cd-analytics-title">{reel.title}</p>
                                                <p className="cd-analytics-restaurant">🏪 {reel.restaurantId?.restaurantName}</p>
                                            </div>
                                            <div className="cd-analytics-metrics">
                                                <div className="cd-metric">
                                                    <span className="cd-metric-icon">👁️</span>
                                                    <span className="cd-metric-val">{reel.views || 0}</span>
                                                    <span className="cd-metric-label">Views</span>
                                                </div>
                                                <div className="cd-metric">
                                                    <span className="cd-metric-icon">❤️</span>
                                                    <span className="cd-metric-val">{reel.likedBy?.length || 0}</span>
                                                    <span className="cd-metric-label">Likes</span>
                                                </div>
                                                <div className="cd-metric">
                                                    <span className="cd-metric-icon">💬</span>
                                                    <span className="cd-metric-val">{reel.comments?.length || 0}</span>
                                                    <span className="cd-metric-label">Comments</span>
                                                </div>
                                                <div className="cd-metric cd-metric-money">
                                                    <span className="cd-metric-icon">💵</span>
                                                    <span className="cd-metric-val">
                                                        ${(((reel.views || 0) / 20 * 0.012) + ((reel.likedBy?.length || 0) / 100 * 0.012)).toFixed(3)}
                                                    </span>
                                                    <span className="cd-metric-label">Earnings</span>
                                                </div>
                                            </div>

                                            {/* comments list */}
                                            {reel.comments?.length > 0 && (
                                                <div className="cd-analytics-comments">
                                                    <p className="cd-comments-head">Comments ({reel.comments.length})</p>
                                                    <div className="cd-comment-list-scroll">
                                                        {reel.comments.slice().reverse().map((c, i) => (
                                                            <div className="cd-comment-group" key={i}>
                                                                <div className="cd-comment-item">
                                                                    <div className="cd-comment-main">
                                                                        <span className="cd-comment-user">{c.userName || "User"}</span>
                                                                        <span className="cd-comment-text">{c.text}</span>
                                                                        <div className="cd-comment-actions">
                                                                            <button onClick={() => handleLikeComment(reel._id, c._id)} className={c.likedBy?.includes(user.id) ? "active" : ""}>
                                                                                {c.likedBy?.includes(user.id) ? "❤️" : "🤍"} {c.likedBy?.length || 0}
                                                                            </button>
                                                                            <button onClick={() => setReplyTo({ reelId: reel._id, commentId: c._id, userName: c.userName })}>Reply</button>
                                                                            <button onClick={() => handleDeleteComment(reel._id, c._id)} className="cd-btn-delete-small">Delete</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {c.replies?.length > 0 && (
                                                                    <div className="cd-replies-list">
                                                                        {c.replies.map((reply, ri) => (
                                                                            <div className="cd-reply-item" key={ri}>
                                                                                <span className="cd-comment-user">{reply.userName}</span>
                                                                                <span className="cd-comment-text">{reply.text}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {replyTo && replyTo.reelId === reel._id && (
                                                        <div className="cd-reply-input-box">
                                                            <div className="cd-reply-to-label">Replying to @{replyTo.userName} <button onClick={() => setReplyTo(null)}>✕</button></div>
                                                            <div className="cd-reply-input-row">
                                                                <input
                                                                    type="text"
                                                                    className="cd-input"
                                                                    placeholder="Type your reply..."
                                                                    value={newReply}
                                                                    onChange={(e) => setNewReply(e.target.value)}
                                                                />
                                                                <button className="cd-btn-save" onClick={handleReplyComment} disabled={!newReply.trim()}>Send</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                </div>
            </main>

            {/* ── EDIT MODAL ── */}
            {editReel && (
                <div className="cd-modal-backdrop" onClick={() => setEditReel(null)}>
                    <div className="cd-modal" onClick={e => e.stopPropagation()}>
                        <div className="cd-modal-head">
                            <span>✏️ Edit Reel</span>
                            <button className="cd-modal-close" onClick={() => setEditReel(null)}>✕</button>
                        </div>
                        <div className="cd-modal-body">
                            <div className="cd-field">
                                <label className="cd-label">Title *</label>
                                <input className="cd-input" value={editReel.title}
                                    onChange={e => setEditReel({ ...editReel, title: e.target.value })} />
                            </div>
                            <div className="cd-field">
                                <div className="cd-label-row">
                                    <label className="cd-label">Description</label>
                                    <button type="button" className="cd-btn-ai" onClick={() => handleGenerateDesc(true)} disabled={generatingDesc}>
                                        {generatingDesc ? <span className="cd-ai-spinner">⏳</span> : "✨"} {generatingDesc ? "Generating…" : "AI Generate"}
                                    </button>
                                </div>
                                <textarea className="cd-input cd-textarea" value={editReel.description}
                                    onChange={e => setEditReel({ ...editReel, description: e.target.value })} />
                            </div>
                        </div>
                        <div className="cd-modal-footer">
                            <button className="cd-btn-cancel" onClick={() => setEditReel(null)}>Cancel</button>
                            <button className="cd-btn-save" onClick={handleEditSave} disabled={editSaving}>
                                {editSaving ? "Saving…" : "💾 Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
