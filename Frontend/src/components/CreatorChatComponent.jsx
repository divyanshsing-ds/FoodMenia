import { useState, useEffect, useRef, useCallback } from "react";
import CONFIG from "../utils/config";
import socket from "../utils/socket";

/**
 * CreatorChatComponent
 * Props:
 *   token         — creator JWT
 *   user          — creator data
 *   showToast     — optional toast callback
 */
export default function CreatorChatComponent({ token, user }) {
    const [myChats, setMyChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [activeChatLoading, setActiveChatLoading] = useState(false);
    const [msgText, setMsgText] = useState("");
    const [sending, setSending] = useState(false);
    const [negotiatingMsgId, setNegotiatingMsgId] = useState(null);
    const [counterPrice, setCounterPrice] = useState("");
    const chatBottomRef = useRef(null);

    const fetchMyChats = useCallback(async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/my-chats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setMyChats(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch chats", err);
        }
    }, [token]);

    useEffect(() => {
        fetchMyChats();
    }, [fetchMyChats]);

    // Socket initialization and listeners
    useEffect(() => {
        if (!socket.connected) socket.connect();

        const handleNewMessage = (msg) => {
            setActiveChat(prev => {
                if (!prev || (msg.chatId && prev._id !== msg.chatId)) return prev;
                // Check if message already exists (prevent duplicates if sent via POST then socket)
                if (prev.messages && prev.messages.some(m => m._id === msg._id)) return prev;
                return {
                    ...prev,
                    messages: prev.messages ? [...prev.messages, msg] : [msg]
                };
            });
            fetchMyChats(); // refresh sidebar list
        };

        const handleOfferUpdated = (updatedChat) => {
            setActiveChat(prev => (prev?._id === updatedChat._id ? updatedChat : prev));
            fetchMyChats(); // refresh sidebar list
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
    }, [fetchMyChats]);

    // Join room when active chat changes
    useEffect(() => {
        if (activeChat?._id) {
            socket.emit("join_chat", activeChat._id);
        }
    }, [activeChat?._id]);

    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [activeChat?.messages?.length]);

    const openChat = async (chatId) => {
        setActiveChatLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/chat/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat(data.data);
                fetchMyChats(); // refresh list to update unread status
            }
        } catch (err) {
            console.error("Failed to open chat", err);
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
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: msgText.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                // Do NOT push to state here — the socket 'new_message' event
                // will deliver it to both sender and receiver exactly once.
                setMsgText("");
            }
        } catch (err) {
            console.error("Send failed", err);
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
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat(data.data);
                setNegotiatingMsgId(null);
                setCounterPrice("");
            }
        } catch (err) {
            console.error("Offer action failed", err);
        }
    };

    return (
        <div className="collab-root h-calc-180">
            <div className="collab-sidebar">
                <div className="collab-sidebar-tabs">
                    <div className="collab-sidebar-tab active text-center w-full">
                        💬 Conversations
                    </div>
                </div>
                <div className="collab-chats-list">
                    {myChats.length === 0 ? (
                        <div className="collab-empty-sidebar">No messages yet.</div>
                    ) : (
                        myChats.map(chat => (
                            <div
                                key={chat._id}
                                className={`collab-chat-item ${activeChat?._id === chat._id ? "active" : ""}`}
                                onClick={() => openChat(chat._id)}
                            >
                                <div className="collab-chat-item-avatar">
                                    {chat.operatorName.charAt(0).toUpperCase()}
                                </div>
                                <div className="collab-chat-item-info">
                                    <div className="collab-chat-item-name">{chat.operatorName}</div>
                                    <div className="text-xs opacity-60">
                                        {chat.offerStatus !== "none" ? `Offer: ${chat.offerStatus}` : "Operator"}
                                    </div>
                                </div>
                                {chat.unreadByCreator > 0 && (
                                    <span className="collab-unread-badge">{chat.unreadByCreator}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="collab-main">
                {!activeChat ? (
                    <div className="collab-placeholder">
                        <div className="collab-placeholder-icon">📬</div>
                        <div className="collab-placeholder-title">Select a conversation</div>
                        <div className="collab-placeholder-desc">
                            View collaboration offers and messages from restaurant operators here.
                        </div>
                    </div>
                ) : activeChatLoading ? (
                    <div className="collab-placeholder">
                        <div className="collab-loading">Loading messages…</div>
                    </div>
                ) : (
                    <>
                        <div className="collab-chat-header">
                            <div className="collab-chat-header-left">
                                <div className="collab-chat-header-avatar">
                                    {activeChat.operatorName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="collab-chat-header-name">{activeChat.operatorName}</div>
                                    <div className="collab-chat-header-sub">Restaurant Operator</div>
                                </div>
                            </div>
                        </div>

                        <div className="collab-messages">
                            {activeChat.messages.map((msg, i) => {
                                const isMe = msg.senderRole === "creator";
                                return (
                                    <div key={msg._id || i} className={`collab-msg-row ${isMe ? "me" : "them"}`}>
                                        <div className={`collab-msg-bubble ${msg.isOffer ? "offer-bubble" : ""} ${isMe ? "me" : "them"}`}>
                                            {msg.isOffer && (
                                                <div className="collab-offer-header mb-10">
                                                    <div className="text-bold text-amber text-sm">
                                                        💼 COLLABORATION OFFER
                                                    </div>
                                                    <div className="text-lg my-4">
                                                        ₹{msg.offerAmount?.toLocaleString()}
                                                    </div>

                                                    {msg.offerStatus === "pending" && !isMe ? (
                                                        <div className="collab-offer-actions-wrap mt-10">
                                                            <div className="collab-offer-actions flex gap-6">
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
                                                                        placeholder="Your price (₹)"
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
                                                    ) : (
                                                        <span className={`collab-offer-pill ${msg.offerStatus}`}>
                                                            {msg.offerStatus === "pending" && "⏳ Pending"}
                                                            {msg.offerStatus === "accepted" && "✅ Accepted"}
                                                            {msg.offerStatus === "rejected" && "❌ Rejected"}
                                                            {msg.offerStatus === "negotiating" && "🤝 Negotiating"}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="collab-msg-text">{msg.text}</div>
                                            <div className="collab-msg-time">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatBottomRef} />
                        </div>

                        <form className="collab-input-bar" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                className="collab-input"
                                placeholder="Type a message..."
                                value={msgText}
                                onChange={(e) => setMsgText(e.target.value)}
                                disabled={sending}
                            />
                            <button type="submit" className="collab-send-btn" disabled={sending || !msgText.trim()}>
                                {sending ? "..." : "Send ➤"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
