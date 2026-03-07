import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CONFIG from "../utils/config";
import "../styles/dashboard.css";

// Sub-component for each reel card in the grid to maintain its own node references safely
function CreatorReelCard({ reel, onClick }) {
    const videoRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current) {
            videoRef.current.play().catch(() => { });
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div
            className="creator-reel-profile-card"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => onClick(reel._id)}
        >
            <video
                ref={videoRef}
                src={reel.videoUrl?.startsWith("http") ? reel.videoUrl : `${CONFIG.UPLOADS_BASE}${reel.videoUrl}`}
                className="creator-reel-video"
                muted
                loop
                preload="metadata"
            />
            <div className="creator-reel-overlay">
                <h4 className="creator-reel-title">{reel.title}</h4>
                <div className="creator-reel-stats">
                    <span>👁️ {reel.views || 0}</span>
                    <span>❤️ {reel.likedBy?.length || 0}</span>
                </div>
            </div>
        </div>
    );
}

export default function CreatorPublicProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [creator, setCreator] = useState(null);
    const [reels, setReels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(false);

    const fetchCreatorData = useCallback(async () => {
        if (!creator) setLoading(true); // Only show loading on initial fetch
        try {
            // 1. Fetch Creator Info
            const profileRes = await fetch(`${CONFIG.API_BASE}/auth/creator/${id}`);
            const profileData = await profileRes.json();

            if (profileData.success) {
                setCreator(profileData.data);

                // Read fresh following state
                const currentUser = JSON.parse(localStorage.getItem(CONFIG.dataKey("user")) || "{}");
                setFollowing(currentUser.following?.includes(id));

                // 2. Then Fetch Creator's Reels
                const videoRes = await fetch(`${CONFIG.API_BASE}/video/creator/${id}`);
                const videoData = await videoRes.json();
                if (videoData.success) {
                    setReels(videoData.data);
                }
            } else {
                setCreator(null);
            }
        } catch (err) {
            console.error("Failed to load creator profile:", err);
            setCreator(null);
        } finally {
            setLoading(false);
        }
    }, [id]); // Fixed: only re-fetch if the profile ID changes

    useEffect(() => {
        fetchCreatorData();
    }, [fetchCreatorData]);

    const handleFollow = async () => {
        const token = localStorage.getItem(CONFIG.tokenKey("user"));
        const currentUser = JSON.parse(localStorage.getItem(CONFIG.dataKey("user")) || "{}");

        if (!token) return navigate("/");
        try {
            const res = await fetch(`${CONFIG.API_BASE}/creator/${id}/follow`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            const data = await res.json();
            if (data.success) {
                setFollowing(data.isFollowing);
                // Update local creator followers count for instant feedback
                if (creator) {
                    const currentFollowers = creator.followers || [];
                    const updatedFollowers = data.isFollowing
                        ? [...currentFollowers, currentUser.id]
                        : currentFollowers.filter(uid => uid !== currentUser.id);
                    setCreator({ ...creator, followers: updatedFollowers });
                }

                // Sync local storage user data
                const updatedUser = {
                    ...currentUser,
                    following: data.isFollowing
                        ? [...(currentUser.following || []), id]
                        : (currentUser.following || []).filter(cid => cid !== id)
                };
                localStorage.setItem(CONFIG.dataKey("user"), JSON.stringify(updatedUser));
            }
        } catch (err) {
            console.error("Follow failed:", err);
        }
    };

    const handleReelClick = (reelId) => {
        navigate("/user", { state: { focusReel: reelId, tab: "reels" } });
    };

    if (!creator) {
        if (loading) return <div className="dashboard-layout bg-black min-h-screen" />;

        return (
            <div className="dashboard-layout">
                <div className="dash-content">
                    <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
                    <div className="empty-state">
                        <div className="empty-icon">👤</div>
                        <div className="empty-title">Creator Not Found</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            <nav className="dash-navbar">
                <div className="dash-brand cursor-pointer" onClick={() => navigate("/user")}>🍕 FoodMenia</div>
                <div className="dash-nav-right">
                    <button className="btn-secondary" onClick={() => navigate(-1)}>
                        ← Back to Feed
                    </button>
                </div>
            </nav>

            <div className="dash-content">
                {/* Profile Header */}
                <div className="creator-profile-header">
                    <div className="profile-pic-container">
                        {creator.profilePic ? (
                            <img
                                src={creator.profilePic.startsWith("http") ? creator.profilePic : `${CONFIG.UPLOADS_BASE}${creator.profilePic}`}
                                alt={creator.fullName}
                                className="profile-pic-img"
                            />
                        ) : (
                            creator.fullName?.charAt(0).toUpperCase()
                        )}
                    </div>

                    <div className="flex-grow">
                        <div className="flex-between align-start">
                            <div>
                                <h1 className="profile-name">{creator.fullName}</h1>
                                <p className="profile-handle">
                                    @{creator.fullName?.replace(/\s+/g, "").toLowerCase()}
                                </p>
                            </div>
                            <div className="flex gap-12">
                                <button
                                    onClick={handleFollow}
                                    className={`btn-follow ${following ? "active" : "inactive"}`}
                                >
                                    {following ? "✓ FOLLOWING" : "+ FOLLOW"}
                                </button>
                            </div>
                        </div>

                        <div className="profile-stats">
                            <div className="profile-stat-item">
                                <strong className="profile-stat-val">{reels.length}</strong> <span className="profile-stat-label">Reels</span>
                            </div>
                            <div className="profile-stat-item">
                                <strong className="profile-stat-val">{creator.followers?.length || 0}</strong> <span className="profile-stat-label">Followers</span>
                            </div>
                        </div>

                        {creator.creatorBio && (
                            <p className="profile-bio">
                                {creator.creatorBio}
                            </p>
                        )}
                    </div>
                </div>

                {/* Reels Grid */}
                <h2 className="section-title flex align-center gap-12 mb-20">
                    🎬 All Uploads
                </h2>

                {reels.length > 0 ? (
                    <div className="creator-reels-grid">
                        {reels.map((reel) => (
                            <CreatorReelCard key={reel._id} reel={reel} onClick={handleReelClick} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">🎥</div>
                        <p className="empty-title">No reels uploaded yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
