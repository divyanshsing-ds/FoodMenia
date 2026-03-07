import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/creator.css";
import "../styles/dashboard.css";
import CONFIG from "../utils/config";
import CreatorChatComponent from "../components/CreatorChatComponent";

/**
 * CreatorMessages Page
 * Wraps the CreatorChatComponent inside the creator dashboard layout.
 */
export default function CreatorMessages() {
    const navigate = useNavigate();
    const [user] = useState(() => JSON.parse(localStorage.getItem(CONFIG.dataKey("creator")) || "{}"));
    const token = localStorage.getItem(CONFIG.tokenKey("creator"));

    // Base navigation check
    if (!token || user.role !== "creator") {
        navigate("/");
        return null;
    }

    return (
        <div className="cd-layout">
            <aside className="cd-sidebar">
                <div className="cd-brand cursor-pointer" onClick={() => navigate("/creator")}>🍕 FoodMenia</div>

                <div className="cd-profile">
                    <div className="cd-avatar-wrap">
                        {user.profilePic
                            ? <img src={`${CONFIG.UPLOADS_BASE}${user.profilePic}`} alt="Profile" className="cd-avatar-img" />
                            : <div className="cd-avatar-fallback">🍳</div>}
                    </div>
                    <p className="cd-user-name">{user.fullName}</p>
                    <span className="cd-user-badge">Creator</span>
                </div>

                <nav className="cd-nav">
                    <button className="cd-nav-btn" onClick={() => navigate("/creator")}>
                        <span>🏠</span> Back to Dashboard
                    </button>
                    <button className="cd-nav-btn active">
                        <span>💬</span> Messages
                    </button>
                </nav>

                <button className="cd-logout" onClick={() => {
                    localStorage.removeItem(CONFIG.tokenKey("creator"));
                    localStorage.removeItem(CONFIG.dataKey("creator"));
                    navigate("/");
                }}>
                    <span>🚪</span> Logout
                </button>
            </aside>

            <main className="cd-main">
                <header className="cd-topbar">
                    <div className="cd-welcome">Collaboration <strong>Messages</strong> 📩</div>
                </header>

                <div className="cd-content p-10">
                    <CreatorChatComponent token={token} user={user} />
                </div>
            </main>
        </div>
    );
}
