import { useState, useEffect, useRef, useCallback } from "react";
import CONFIG from "../utils/config";
import socket from "../utils/socket";

/**
 * OperatorCreatorChat
 * Props:
 *   token         — operator JWT
 *   user          — operator data from localStorage
 *   showToast     — (type, text) callback from OperatorDashboard
 */
export default function OperatorCreatorChat({ token, user, showToast }) {
    // ─── Creator Discovery state ───────────────────────────────────────────────
    const [creators, setCreators] = useState([]);
    const [creatorsLoading, setCreatorsLoading] = useState(false);
    const [sortBy, setSortBy] = useState("engagementScore");   // "followerCount" | "totalViews" | "totalLikes" | "engagementScore" | "reelCount"
    const [filterQuery, setFilterQuery] = useState("");

    // ─── Chat panel state ──────────────────────────────────────────────────────
    const [myChats, setMyChats] = useState([]);                // chat list (no messages)
    const [activeChat, setActiveChat] = useState(null);        // full chat with messages
    const [activeChatLoading, setActiveChatLoading] = useState(false);
    const [view, setView] = useState("discover");              // "discover" | "chats"

    // ─── Message input state ───────────────────────────────────────────────────
    const [msgText, setMsgText] = useState("");
    const [sending, setSending] = useState(false);

    // ─── Offer modal state ─────────────────────────────────────────────────────
    const [offerModal, setOfferModal] = useState(false);
    const [offerAmount, setOfferAmount] = useState("");
    const [offerNote, setOfferNote] = useState("");
    const [negotiatingMsgId, setNegotiatingMsgId] = useState(null);
    const [counterPrice, setCounterPrice] = useState("");

    const chatBottomRef = useRef(null);

    const authHeaders = useCallback(() => ({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    }), [token]);

    // ─── Load creators on mount ────────────────────────────────────────────────
    const fetchCreators = useCallback(async () => {
        setCreatorsLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/creators`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setCreators(data.data);
            else showToast("error", data.message || "Failed to load creators");
        } catch {
            showToast("error", "Could not reach server");
        } finally {
            setCreatorsLoading(false);
        }
    }, [token, showToast]);

    const fetchMyChats = useCallback(async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/my-chats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setMyChats(data.data);
        } catch { /* silent */ }
    }, [token]);

    useEffect(() => {
        fetchCreators();
        fetchMyChats();
    }, [fetchCreators, fetchMyChats]);

    // Auto-scroll chat to bottom on new messages
    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [activeChat?.messages?.length]);

    // Socket initialization and listeners
    useEffect(() => {
        if (!socket.connected) socket.connect();

        const handleNewMessage = (msg) => {
            setActiveChat(prev => {
                if (!prev || (msg.chatId && prev._id !== msg.chatId)) {
                    // if it's the wrong chat, we could refresh the list for unread counts
                    fetchMyChats();
                    return prev;
                }
                // Check if message already exists (prevent duplicates if sent via POST then socket)
                if (prev.messages.some(m => m._id === msg._id)) return prev;
                return { ...prev, messages: [...prev.messages, msg] };
            });
        };

        const handleOfferUpdated = (updatedChat) => {
            setActiveChat(prev => (prev?._id === updatedChat._id ? updatedChat : prev));
            fetchMyChats(); // update unread / status in list
        };

        const handleChatUpdated = (updatedChat) => {
            fetchMyChats();
            setActiveChat(prev => (prev?._id === updatedChat._id ? updatedChat : prev));
        }

        socket.on("new_message", handleNewMessage);
        socket.on("offer_updated", handleOfferUpdated);
        socket.on("chat_updated", handleChatUpdated);

        return () => {
            socket.off("new_message", handleNewMessage);
            socket.off("offer_updated", handleOfferUpdated);
            socket.off("chat_updated", handleChatUpdated);
        };
    }, [fetchMyChats, token]);

    // Join room when active chat changes
    useEffect(() => {
        if (activeChat?._id) {
            socket.emit("join_chat", activeChat._id);
        }
    }, [activeChat?._id]);

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleContactCreator = async (creator) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/start/${creator._id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                await openChat(data.data._id);
                setView("chats");
                fetchMyChats();
            } else {
                showToast("error", data.message || "Failed to start chat");
            }
        } catch {
            showToast("error", "Server error");
        }
    };

    const openChat = async (chatId) => {
        setActiveChatLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat(data.data);
                setView("chats");
            }
        } catch {
            showToast("error", "Failed to load chat");
        } finally {
            setActiveChatLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!msgText.trim() || !activeChat) return;
        setSending(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/${activeChat._id}/message`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ text: msgText.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                // Do NOT push to state here — the socket 'new_message' event
                // will deliver it to both sender and receiver exactly once.
                setMsgText("");
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const handleSendOffer = async () => {
        if (!offerAmount || isNaN(offerAmount) || Number(offerAmount) <= 0) {
            showToast("error", "Please enter a valid offer amount");
            return;
        }
        setSending(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/${activeChat._id}/offer`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    amount: Number(offerAmount),
                    text: offerNote.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat((prev) => ({
                    ...prev,
                    messages: [...prev.messages, data.data],
                    offerStatus: "pending",
                    latestOfferAmount: Number(offerAmount),
                }));
                setOfferModal(false);
                setOfferAmount("");
                setOfferNote("");
                showToast("success", "Collaboration offer sent! 🚀");
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Failed to send offer");
        } finally {
            setSending(false);
        }
    };

    const handleOfferAction = async (msgId, action, counterAmount) => {
        try {
            const body = { action };
            if (action === "negotiate" && counterAmount) {
                body.counterAmount = Number(counterAmount);
            }

            const res = await fetch(`${CONFIG.API_BASE}/chat/${activeChat._id}/offer/${msgId}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat(data.data);
                setNegotiatingMsgId(null);
                setCounterPrice("");
                showToast("success", `Offer ${action}ed!`);
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Action failed");
        }
    };

    // ─── Derived: sorted & filtered creators ──────────────────────────────────
    const filteredCreators = creators
        .filter((c) =>
            filterQuery
                ? c.fullName.toLowerCase().includes(filterQuery.toLowerCase()) ||
                c.creatorBio?.toLowerCase().includes(filterQuery.toLowerCase())
                : true
        )
        .sort((a, b) => b[sortBy] - a[sortBy]);

    // ─── Helpers ───────────────────────────────────────────────────────────────
    const formatNum = (n) =>
        n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

    const offerStatusLabel = {
        none: null,
        pending: { text: "⏳ Offer Pending", cls: "collab-offer-status pending" },
        accepted: { text: "✅ Offer Accepted", cls: "collab-offer-status accepted" },
        rejected: { text: "❌ Offer Rejected", cls: "collab-offer-status rejected" },
        negotiating: { text: "🤝 Negotiating", cls: "collab-offer-status negotiating" },
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="collab-root">
            {/* ── LEFT SIDEBAR ── */}
            <div className="collab-sidebar">
                {/* Tab switch */}
                <div className="collab-sidebar-tabs">
                    <button
                        className={`collab-sidebar-tab ${view === "discover" ? "active" : ""}`}
                        onClick={() => setView("discover")}
                    >
                        🔍 Discover
                    </button>
                    <button
                        className={`collab-sidebar-tab ${view === "chats" ? "active" : ""}`}
                        onClick={() => { setView("chats"); fetchMyChats(); }}
                    >
                        💬 Chats
                        {myChats.some((c) => c.unreadByOperator > 0) && (
                            <span className="collab-unread-dot" />
                        )}
                    </button>
                </div>

                {/* Discover Sidebar */}
                {view === "discover" && (
                    <div className="collab-discover-sidebar">
                        <div className="collab-search-row">
                            <input
                                type="text"
                                className="collab-search"
                                placeholder="Search creators..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                            />
                        </div>
                        <div className="collab-sort-row">
                            <span className="collab-sort-label">Sort by</span>
                            <select
                                className="collab-sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="engagementScore">Engagement</option>
                                <option value="followerCount">Followers</option>
                                <option value="totalViews">Views</option>
                                <option value="totalLikes">Likes</option>
                                <option value="reelCount">Reels</option>
                            </select>
                        </div>

                        {creatorsLoading ? (
                            <div className="collab-loading">Loading creators…</div>
                        ) : filteredCreators.length === 0 ? (
                            <div className="collab-empty-sidebar">No creators found.</div>
                        ) : (
                            <div className="collab-creator-list">
                                {filteredCreators.map((c) => (
                                    <div
                                        key={c._id}
                                        className="collab-creator-card"
                                        onClick={() => handleContactCreator(c)}
                                        title="Click to contact this creator"
                                    >
                                        <div className="collab-creator-avatar">
                                            {c.profilePic ? (
                                                <img
                                                    src={`${CONFIG.UPLOADS_BASE}${c.profilePic}`}
                                                    alt={c.fullName}
                                                />
                                            ) : (
                                                <span>{c.fullName.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="collab-creator-info">
                                            <div className="collab-creator-name">{c.fullName}</div>
                                            <div className="collab-creator-bio">{c.creatorBio || "Creator"}</div>
                                            <div className="collab-creator-stats">
                                                <span>👥 {formatNum(c.followerCount)}</span>
                                                <span>👁️ {formatNum(c.totalViews)}</span>
                                                <span>❤️ {formatNum(c.totalLikes)}</span>
                                                <span>🎬 {c.reelCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Chats Sidebar */}
                {view === "chats" && (
                    <div className="collab-chats-list">
                        {myChats.length === 0 ? (
                            <div className="collab-empty-sidebar">
                                No conversations yet.<br />
                                <span className="text-xs opacity-50">
                                    Discover creators to start chatting.
                                </span>
                            </div>
                        ) : (
                            myChats.map((chat) => {
                                const status = offerStatusLabel[chat.offerStatus];
                                return (
                                    <div
                                        key={chat._id}
                                        className={`collab-chat-item ${activeChat?._id === chat._id ? "active" : ""}`}
                                        onClick={() => openChat(chat._id)}
                                    >
                                        <div className="collab-chat-item-avatar">
                                            {chat.creatorId?.profilePic ? (
                                                <img
                                                    src={`${CONFIG.UPLOADS_BASE}${chat.creatorId.profilePic}`}
                                                    alt={chat.creatorName}
                                                    className="collab-avatar-img"
                                                />
                                            ) : (
                                                chat.creatorName.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="collab-chat-item-info">
                                            <div className="collab-chat-item-name">{chat.creatorName}</div>
                                            {status && (
                                                <div className="text-xs opacity-70 mt-4">
                                                    {status.text}
                                                </div>
                                            )}
                                            {chat.latestOfferAmount && (
                                                <div className="text-xs text-amber">
                                                    ₹{chat.latestOfferAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                        {chat.unreadByOperator > 0 && (
                                            <span className="collab-unread-badge">
                                                {chat.unreadByOperator}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* ── MAIN CHAT PANEL ── */}
            <div className="collab-main">
                {!activeChat ? (
                    <div className="collab-placeholder">
                        <div className="collab-placeholder-icon">🤝</div>
                        <div className="collab-placeholder-title">Creator Collaborations</div>
                        <div className="collab-placeholder-desc">
                            Discover platform creators, view their stats, and offer paid collaborations for promotional food videos.
                        </div>
                        <button className="btn-primary mt-20" onClick={() => setView("discover")}>
                            🔍 Browse Creators
                        </button>
                    </div>
                ) : activeChatLoading ? (
                    <div className="collab-placeholder">
                        <div className="collab-loading">Loading chat…</div>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="collab-chat-header">
                            <div className="collab-chat-header-left">
                                <div className="collab-chat-header-avatar">
                                    {activeChat.creatorId?.profilePic ? (
                                        <img
                                            src={`${CONFIG.UPLOADS_BASE}${activeChat.creatorId.profilePic}`}
                                            alt={activeChat.creatorName}
                                            className="collab-avatar-img"
                                        />
                                    ) : (
                                        activeChat.creatorName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <div className="collab-chat-header-name">{activeChat.creatorName}</div>
                                    <div className="collab-chat-header-sub">Creator</div>
                                </div>
                            </div>
                            <div className="collab-chat-header-right">
                                {activeChat.offerStatus !== "none" && offerStatusLabel[activeChat.offerStatus] && (
                                    <span className={offerStatusLabel[activeChat.offerStatus].cls}>
                                        {offerStatusLabel[activeChat.offerStatus].text}
                                        {activeChat.latestOfferAmount && (
                                            <> · ₹{activeChat.latestOfferAmount.toLocaleString()}</>
                                        )}
                                    </span>
                                )}
                                <button
                                    className="collab-new-offer-btn"
                                    onClick={() => setOfferModal(true)}
                                >
                                    💰 Send Offer
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="collab-messages">
                            {activeChat.messages.length === 0 ? (
                                <div className="collab-no-messages">
                                    👋 Start the conversation. Say hello or send a collaboration offer!
                                </div>
                            ) : (
                                activeChat.messages.map((msg, i) => {
                                    const isMe = msg.senderRole === "operator";
                                    return (
                                        <div
                                            key={msg._id || i}
                                            className={`collab-msg-row ${isMe ? "me" : "them"}`}
                                        >
                                            {!isMe && (
                                                <div className="collab-msg-avatar">
                                                    {activeChat.creatorId?.profilePic ? (
                                                        <img
                                                            src={`${CONFIG.UPLOADS_BASE}${activeChat.creatorId.profilePic}`}
                                                            alt={msg.senderName}
                                                            className="collab-avatar-img"
                                                        />
                                                    ) : (
                                                        msg.senderName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                            )}
                                            <div className={`collab-msg-bubble ${msg.isOffer ? "offer-bubble" : ""} ${isMe ? "me" : "them"}`}>
                                                {msg.isOffer && (
                                                    <div className="collab-offer-header mb-10">
                                                        <span className="collab-offer-tag">💼 COLLABORATION OFFER</span>
                                                        <span className="collab-offer-amount">₹{msg.offerAmount?.toLocaleString()}</span>
                                                        <span className={`collab-offer-pill ${msg.offerStatus}`}>
                                                            {msg.offerStatus === "pending" && "⏳ Pending"}
                                                            {msg.offerStatus === "accepted" && "✅ Accepted"}
                                                            {msg.offerStatus === "rejected" && "❌ Rejected"}
                                                            {msg.offerStatus === "negotiating" && "🤝 Negotiating"}
                                                        </span>

                                                        {msg.offerStatus === "pending" && !isMe && (
                                                            <div className="collab-offer-actions-wrap mt-12 w-full">
                                                                <div className="flex gap-10">
                                                                    <button
                                                                        className="collab-btn-accept"
                                                                        onClick={() => handleOfferAction(msg._id, "accept")}
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        className="collab-btn-negotiate"
                                                                        onClick={() => setNegotiatingMsgId(msg._id)}
                                                                    >
                                                                        Negotiate
                                                                    </button>
                                                                    <button
                                                                        className="collab-btn-reject"
                                                                        onClick={() => handleOfferAction(msg._id, "reject")}
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>

                                                                {negotiatingMsgId === msg._id && (
                                                                    <div className="collab-negotiate-box">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Counter price (₹)"
                                                                            className="collab-negotiate-input"
                                                                            value={counterPrice}
                                                                            onChange={(e) => setCounterPrice(e.target.value)}
                                                                            autoFocus
                                                                        />
                                                                        <button
                                                                            className="collab-negotiate-send-btn"
                                                                            onClick={() => handleOfferAction(msg._id, "negotiate", counterPrice)}
                                                                        >
                                                                            Send
                                                                        </button>
                                                                        <button
                                                                            className="collab-negotiate-close-btn"
                                                                            onClick={() => setNegotiatingMsgId(null)}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="collab-msg-text">{msg.text}</div>
                                                <div className="collab-msg-time">
                                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        {/* Input bar */}
                        <form className="collab-input-bar" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                className="collab-input"
                                placeholder="Type a message…"
                                value={msgText}
                                onChange={(e) => setMsgText(e.target.value)}
                                disabled={sending}
                            />
                            <button
                                type="button"
                                className="collab-offer-quick-btn"
                                onClick={() => setOfferModal(true)}
                                title="Send a collaboration offer"
                            >
                                💼
                            </button>
                            <button
                                type="submit"
                                className="collab-send-btn"
                                disabled={sending || !msgText.trim()}
                            >
                                {sending ? "…" : "Send ➤"}
                            </button>
                        </form>
                    </>
                )}
            </div>

            {/* ── OFFER MODAL ── */}
            {offerModal && (
                <div className="modal-overlay" onClick={() => setOfferModal(false)}>
                    <div
                        className="modal-content collab-offer-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-title">💼 Send Collaboration Offer</div>
                        <div className="modal-body">
                            <div className="mb-8 opacity-60 text-sm">
                                Sending offer to <strong className="text-amber">{activeChat?.creatorName}</strong>
                            </div>
                            <div className="form-group mb-16">
                                <label>Offer Amount (₹) *</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 2000"
                                    min="1"
                                    value={offerAmount}
                                    onChange={(e) => setOfferAmount(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Message (optional)</label>
                                <textarea
                                    placeholder={`e.g. Make a promotional reel for ${user.restaurantName || "my restaurant"} for ₹${offerAmount || "___"}.`}
                                    value={offerNote}
                                    onChange={(e) => setOfferNote(e.target.value)}
                                    className="min-h-80"
                                />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn-icon"
                                onClick={() => { setOfferModal(false); setOfferAmount(""); setOfferNote(""); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSendOffer}
                                disabled={sending}
                            >
                                {sending ? "Sending…" : "🚀 Send Offer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
