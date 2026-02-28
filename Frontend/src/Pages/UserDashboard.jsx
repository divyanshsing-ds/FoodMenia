import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import CONFIG from "../utils/config";
import { getNutritionInfo } from "../utils/gemini";

const TRACKING_STEPS = [
    { key: "pending", label: "Placed", icon: "📝" },
    { key: "confirmed", label: "Confirmed", icon: "✅" },
    { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
    { key: "out_for_delivery", label: "Out for Delivery", icon: "🚗" },
    { key: "delivered", label: "Delivered", icon: "🎉" },
];

export default function UserDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("browse");
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [cart, setCart] = useState([]);
    const [reels, setReels] = useState([]);
    const [showComments, setShowComments] = useState({ show: false, reelId: null });
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState(null); // { commentId, userName }
    const [showCart, setShowCart] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [quantities, setQuantities] = useState({});
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [ratingModal, setRatingModal] = useState({ show: false, item: null, orderId: null });
    const [userRating, setUserRating] = useState(5);
    const [userComment, setUserComment] = useState("");
    const [cancellationModal, setCancellationModal] = useState({ show: false, orderId: null, reason: "" });
    const [nutritionData, setNutritionData] = useState({}); // keyed by order._id
    const [loadingNutrition, setLoadingNutrition] = useState({});
    const [cartNutrition, setCartNutrition] = useState(null);
    const [loadingCartNutrition, setLoadingCartNutrition] = useState(false);
    const [displayReels, setDisplayReels] = useState([]);
    const [reviewPanel, setReviewPanel] = useState({ show: false, item: null });
    const orderStatusRef = useRef({});

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token");

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    };

    const authHeaders = useCallback(
        () => ({
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        }),
        [token]
    );

    const fetchReels = useCallback(async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/feed`);
            const data = await res.json();
            if (data.success) {
                setReels(data.data);
                setDisplayReels([...data.data, ...data.data, ...data.data]);
            }
        } catch {
            showToast("error", "Failed to load reels");
        }
    }, [authHeaders]);

    const handleScroll = useCallback(() => {
        if (activeTab !== "reels" || reels.length === 0) return;
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 800) {
            setDisplayReels((prev) => [...prev, ...reels]);
        }
    }, [activeTab, reels]);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    // Helper: patch a reel in both reels + displayReels states
    const patchReel = (reelId, updater) => {
        setReels(prev => prev.map(r => r._id === reelId ? updater(r) : r));
        setDisplayReels(prev => prev.map(r => r._id === reelId ? updater(r) : r));
    };

    const handleLike = async (reelId) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${reelId}/like`, {
                method: "POST",
                headers: authHeaders()
            });
            const data = await res.json();
            if (data.success) {
                patchReel(reelId, r => ({
                    ...r,
                    likedBy: data.liked
                        ? [...new Set([...(r.likedBy || []), user.id])]
                        : (r.likedBy || []).filter(id => id !== user.id)
                }));
            }
        } catch {
            showToast("error", "Failed to like reel");
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const url = replyTo
                ? `${CONFIG.API_BASE}/video/${showComments.reelId}/comment/${replyTo.commentId}/reply`
                : `${CONFIG.API_BASE}/video/${showComments.reelId}/comment`;

            const res = await fetch(url, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ text: newComment })
            });
            const data = await res.json();
            if (data.success) {
                patchReel(showComments.reelId, r => {
                    if (replyTo) {
                        return {
                            ...r,
                            comments: r.comments.map(c =>
                                c._id === replyTo.commentId
                                    ? { ...c, replies: [...(c.replies || []), data.data] }
                                    : c
                            )
                        };
                    } else {
                        return { ...r, comments: [...(r.comments || []), data.data] };
                    }
                });
                setNewComment("");
                setReplyTo(null);
            }
        } catch {
            showToast("error", replyTo ? "Failed to post reply" : "Failed to post comment");
        }
    };

    const handleLikeComment = async (commentId) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${showComments.reelId}/comment/${commentId}/like`, {
                method: "POST",
                headers: authHeaders()
            });
            const data = await res.json();
            if (data.success) {
                patchReel(showComments.reelId, r => ({
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
                }));
            }
        } catch {
            showToast("error", "Failed to like comment");
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("Delete this comment?")) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${showComments.reelId}/comment/${commentId}`, {
                method: "DELETE",
                headers: authHeaders()
            });
            const data = await res.json();
            if (data.success) {
                patchReel(showComments.reelId, r => ({
                    ...r,
                    comments: r.comments.filter(c => c._id !== commentId)
                }));
                showToast("success", "Comment deleted");
            }
        } catch {
            showToast("error", "Failed to delete comment");
        }
    };

    // Track which reels have already been counted this session to avoid spam
    const viewedReels = useRef(new Set());

    const handleView = async (reelId) => {
        if (viewedReels.current.has(reelId)) return; // already counted this session
        viewedReels.current.add(reelId);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/video/${reelId}/view`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success) {
                patchReel(reelId, r => ({ ...r, views: data.views }));
            }
        } catch {
            console.error("Failed to increment view count");
        }
    };

    const fetchMenu = useCallback(async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu`);
            const data = await res.json();
            if (data.success) setMenuItems(data.data);
        } catch {
            showToast("error", "Failed to load menu");
        }
    }, []);

    const fetchOrders = useCallback(async (isSilent = false) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/my`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                // Detect status changes for notifications
                data.data.forEach(order => {
                    const prevStatus = orderStatusRef.current[order._id];
                    if (prevStatus && prevStatus !== order.status) {
                        const statusLabels = {
                            confirmed: "confirmed ✅",
                            preparing: "being prepared 👨‍🍳",
                            out_for_delivery: "out for delivery 🚗",
                            delivered: "delivered 🎉",
                            rejected: "rejected ❌"
                        };
                        showToast("info", `Order #${order._id.slice(-6).toUpperCase()} is now ${statusLabels[order.status] || order.status}`);
                    }
                    orderStatusRef.current[order._id] = order.status;
                });
                setOrders(data.data);
            }
        } catch {
            if (!isSilent) showToast("error", "Failed to load orders");
        }
    }, [authHeaders]);

    useEffect(() => {
        fetchMenu();
        fetchReels();
        fetchOrders();
        const interval = setInterval(() => fetchOrders(true), 15000);
        return () => clearInterval(interval);
    }, [fetchMenu, fetchReels, fetchOrders]);

    // Group menu items by restaurant
    const groupedMenu = menuItems.reduce((acc, item) => {
        const key = `${item.operatorId}__${item.restaurantName}`;
        if (!acc[key]) {
            acc[key] = {
                operatorId: item.operatorId,
                restaurantName: item.restaurantName,
                items: [],
            };
        }
        acc[key].items.push(item);
        return acc;
    }, {});

    const restaurantGroups = Object.values(groupedMenu);

    // Filter restaurants or menu items
    const filteredRestaurants = restaurantGroups.filter((group) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            group.restaurantName.toLowerCase().includes(q) ||
            group.items.some(
                (item) =>
                    item.name.toLowerCase().includes(q) ||
                    (item.category || "").toLowerCase().includes(q)
            )
        );
    });

    const filteredMenu = selectedRestaurant
        ? selectedRestaurant.items.filter((item) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                item.name.toLowerCase().includes(q) ||
                (item.category || "").toLowerCase().includes(q)
            );
        })
        : [];

    const getRestaurantImage = (group) => {
        const first = group.items.find((i) => i.image);
        return first
            ? `${CONFIG.UPLOADS_BASE}${first.image}`
            : `https://via.placeholder.com/400x180?text=${encodeURIComponent(group.restaurantName)}`;
    };

    // Cart functions
    const addToCart = (item) => {
        const qty = quantities[item._id] || 1;
        const existing = cart.find((c) => c.menuItemId === item._id);
        if (existing) {
            setCart(
                cart.map((c) =>
                    c.menuItemId === item._id ? { ...c, quantity: c.quantity + qty } : c
                )
            );
        } else {
            setCart([
                ...cart,
                {
                    menuItemId: item._id,
                    name: item.name,
                    price: item.price,
                    quantity: qty,
                    image: item.image,
                    operatorId: item.operatorId,
                    restaurantName: item.restaurantName,
                },
            ]);
        }
        setQuantities({ ...quantities, [item._id]: 1 });
        setCartNutrition(null);
        showToast("success", `${item.name} added to cart!`);
    };

    const removeFromCart = (menuItemId) => {
        setCart(cart.filter((c) => c.menuItemId !== menuItemId));
        setCartNutrition(null);
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            const grouped = cart.reduce((acc, item) => {
                if (!acc[item.operatorId]) {
                    acc[item.operatorId] = {
                        operatorId: item.operatorId,
                        restaurantName: item.restaurantName,
                        items: [],
                    };
                }
                acc[item.operatorId].items.push({
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                });
                return acc;
            }, {});

            for (const group of Object.values(grouped)) {
                const res = await fetch(`${CONFIG.API_BASE}/orders`, {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        operatorId: group.operatorId,
                        restaurantName: group.restaurantName,
                        items: group.items,
                    }),
                });
                const data = await res.json();
                if (!data.success) {
                    showToast("error", data.message || "Order failed");
                    setLoading(false);
                    return;
                }
            }

            showToast("success", "Order placed successfully! 🎉");
            setCart([]);
            setShowCart(false);
            setActiveTab("orders");
            fetchOrders();
        } catch {
            showToast("error", "Failed to place order");
        } finally {
            setLoading(false);
        }
    };

    const handleRate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/${ratingModal.item.menuItemId}/rate`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ rating: userRating, comment: userComment }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "Thanks for your rating! ⭐");
                setRatingModal({ show: false, item: null });
                setUserRating(5);
                setUserComment("");
                fetchMenu();
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Failed to submit rating");
        } finally {
            setLoading(false);
        }
    };

    const handleLikeRating = async (itemId, ratingId) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/${itemId}/rate/${ratingId}/like`, {
                method: "POST",
                headers: authHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setMenuItems(prev => prev.map(item => item._id === itemId ? data.data : item));
                setReviewPanel(prev => ({ ...prev, item: data.data }));
            }
        } catch {
            showToast("error", "Failed to like rating");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
    };

    const fetchNutrition = async (order) => {
        // Keeping this for compatibility or removing it if totally not needed
        // Since we are moving it to cart, let's keep only fetchCartNutrition
    };

    const fetchCartNutrition = async () => {
        if (!cart.length || loadingCartNutrition) return;
        setLoadingCartNutrition(true);
        try {
            const items = cart.map(i => ({ name: i.name, quantity: i.quantity }));
            const result = await getNutritionInfo(items);
            setCartNutrition(result);
        } catch {
            showToast("error", "Failed to analyze cart nutrition");
        } finally {
            setLoadingCartNutrition(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!cancellationModal.reason.trim()) return showToast("error", "Please provide a reason");
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/${cancellationModal.orderId}/cancel`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ reason: cancellationModal.reason }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "Order cancelled successfully");
                setCancellationModal({ show: false, orderId: null, reason: "" });
                fetchOrders();
            } else {
                showToast("error", data.message || "Failed to cancel order");
            }
        } catch {
            showToast("error", "Error cancelling order");
        } finally {
            setLoading(false);
        }
    };


    const getStepState = (order, stepKey) => {
        if (["rejected", "cancelled", "cancel_requested"].includes(order.status)) return "none";
        const statusOrder = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];
        const currentIdx = statusOrder.indexOf(order.status);
        const stepIdx = statusOrder.indexOf(stepKey);
        if (stepIdx < currentIdx) return "completed";
        if (stepIdx === currentIdx) return "current";
        return "none";
    };

    const activeOrders = orders.filter((o) => !["delivered", "rejected", "cancelled"].includes(o.status));
    const pastOrders = orders.filter((o) => ["delivered", "rejected", "cancelled"].includes(o.status));

    const formatStatus = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const updateQty = (itemId, delta) => {
        setQuantities((prev) => {
            const current = prev[itemId] || 1;
            return { ...prev, [itemId]: Math.max(1, current + delta) };
        });
    };

    return (
        <div className="dashboard-layout">
            {/* NAVBAR */}
            <nav className="dash-navbar">
                <div className="dash-brand">🍕 FoodMenia</div>
                <div className="dash-nav-right">
                    <div className="dash-user-info">
                        <div className="dash-user-avatar">{user.fullName?.charAt(0)?.toUpperCase() || "U"}</div>
                        <div>
                            <div className="dash-user-name">{user.fullName}</div>
                            <div className="dash-user-role">👤 User</div>
                        </div>
                    </div>
                    <button className="btn-logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </nav>

            {/* CONTENT */}
            <div className="dash-content">
                <div className="dash-tabs">
                    <button
                        className={`dash-tab ${activeTab === "browse" ? "active" : ""}`}
                        onClick={() => setActiveTab("browse")}
                    >
                        🍔 Browse Food
                    </button>
                    <button
                        className={`dash-tab ${activeTab === "reels" ? "active" : ""}`}
                        onClick={() => setActiveTab("reels")}
                    >
                        🎬 Reels
                    </button>
                    <button
                        className={`dash-tab ${activeTab === "orders" ? "active" : ""}`}
                        onClick={() => setActiveTab("orders")}
                    >
                        📦 My Orders
                        {activeOrders.length > 0 && <span className="tab-badge">{activeOrders.length}</span>}
                    </button>
                </div>

                {activeTab === "browse" && (
                    <div>
                        <div className="section-header">
                            <h2 className="section-title">
                                {selectedRestaurant ? selectedRestaurant.restaurantName : "Choose a Restaurant"}
                            </h2>
                        </div>

                        <div className="search-bar">
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Search restaurants or dishes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {!selectedRestaurant ? (
                            // Restaurant list view
                            filteredRestaurants.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <div className="empty-title">No Restaurants Found</div>
                                </div>
                            ) : (
                                <div className="restaurants-grid">
                                    {filteredRestaurants.map((group) => (
                                        <div
                                            key={group.operatorId}
                                            className="restaurant-banner-card"
                                            onClick={() => {
                                                setSelectedRestaurant(group);
                                                setSearchQuery("");
                                            }}
                                        >
                                            <img
                                                src={getRestaurantImage(group)}
                                                alt={group.restaurantName}
                                                className="restaurant-banner-img"
                                                onError={(e) => {
                                                    e.target.src =
                                                        "https://via.placeholder.com/400x180?text=Restaurant";
                                                }}
                                            />
                                            <div className="restaurant-banner-overlay">
                                                <h3 className="restaurant-banner-name">{group.restaurantName}</h3>
                                                <div className="restaurant-banner-info">
                                                    {group.items.length} items available
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            // Single restaurant menu view
                            <div>
                                <button
                                    className="btn-back"
                                    onClick={() => {
                                        setSelectedRestaurant(null);
                                        setSearchQuery("");
                                    }}
                                >
                                    ← Back to Restaurants
                                </button>

                                <div className="food-grid">
                                    {filteredMenu.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon">🍽️</div>
                                            <div className="empty-title">No matching dishes</div>
                                        </div>
                                    ) : (
                                        filteredMenu.map((item) => (
                                            <div className="food-card" key={item._id}>
                                                {item.image ? (
                                                    <img
                                                        src={`${CONFIG.UPLOADS_BASE}${item.image}`}
                                                        alt={item.name}
                                                        className="food-card-image"
                                                    />
                                                ) : (
                                                    <div className="food-card-placeholder">🍔</div>
                                                )}
                                                <div className="food-card-body">
                                                    <div className="food-card-name">{item.name}</div>
                                                    <div
                                                        className="avg-rating"
                                                        onClick={() => setReviewPanel({ show: true, item: item })}
                                                        style={{ cursor: "pointer" }}
                                                        title="View Reviews"
                                                    >
                                                        <span className="star">★</span> {item.averageRating || "0.0"}
                                                        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>({item.ratings?.length || 0})</span>
                                                    </div>
                                                    <div className="food-card-desc">{item.description || "Delicious dish"}</div>
                                                    <div className="food-card-bottom">
                                                        <div className="food-card-price">₹{item.price}</div>
                                                        <div className="qty-control">
                                                            <button className="qty-btn" onClick={() => updateQty(item._id, -1)}>
                                                                −
                                                            </button>
                                                            <span className="qty-value">{quantities[item._id] || 1}</span>
                                                            <button className="qty-btn" onClick={() => updateQty(item._id, 1)}>
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <button className="btn-add-cart" onClick={() => addToCart(item)}>
                                                        Add to Cart
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* REELS TAB */}
                {activeTab === "reels" && (
                    <div className="reels-container">
                        {displayReels.length > 0 ? (
                            <div className="reels-feed">
                                {displayReels.map((reel, idx) => (
                                    <div className="reel-card" key={`${reel._id}-${idx}`}>
                                        <video
                                            key={reel._id}
                                            src={reel.videoUrl.startsWith("http") ? reel.videoUrl : `${CONFIG.UPLOADS_BASE}${reel.videoUrl}`}
                                            className="reel-video"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            preload="auto"
                                            onClick={(e) => e.target.paused ? e.target.play() : e.target.pause()}
                                            onMouseEnter={(e) => e.target.play().catch(() => { })}
                                            onPlay={() => handleView(reel._id)}
                                        />
                                        <div className="reel-overlay">
                                            <div className="reel-info">
                                                <div className="reel-creator">@{reel.creatorId?.fullName.replace(" ", "").toLowerCase()}</div>
                                                <h3 className="reel-title">{reel.title}</h3>
                                                <div className="reel-meta-row" style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                                                    <span className="reel-views-pill">👁️ {reel.views || 0} views</span>
                                                    <span className="reel-restaurant-pill">🏪 {reel.restaurantId?.restaurantName}</span>
                                                </div>
                                                <p className="reel-description">{reel.description}</p>
                                            </div>
                                            <div className="reel-actions">
                                                <button className="reel-action-btn" onClick={() => handleLike(reel._id)}>
                                                    <span className="icon" style={{ color: reel.likedBy?.includes(user.id) ? "#ff512f" : "#fff" }}>
                                                        {reel.likedBy?.includes(user.id) ? "❤️" : "🤍"}
                                                    </span>
                                                    <span>{reel.likedBy?.length || 0}</span>
                                                </button>
                                                <button className="reel-action-btn" onClick={() => setShowComments({ show: true, reelId: reel._id })}>
                                                    <span className="icon">💬</span>
                                                    <span>{reel.comments?.length || 0}</span>
                                                </button>
                                                <button
                                                    className="btn-primary order-now-btn"
                                                    onClick={() => {
                                                        const group = restaurantGroups.find(g => g.operatorId === reel.restaurantId?._id);
                                                        if (group) {
                                                            setSelectedRestaurant(group);
                                                            setActiveTab("browse");
                                                        } else {
                                                            showToast("error", "Restaurant menu not available");
                                                        }
                                                    }}
                                                >
                                                    🛒 Order Now
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-data">No reels found. Check back later!</div>
                        )}

                        {/* COMMENTS MODAL/DRAWER */}
                        {showComments.show && (
                            <div className="comments-drawer-overlay" onClick={() => setShowComments({ show: false, reelId: null })}>
                                <div className="comments-drawer" onClick={(e) => e.stopPropagation()}>
                                    <div className="drawer-header">
                                        <h3>Comments</h3>
                                        <button className="close-btn" onClick={() => setShowComments({ show: false, reelId: null })}>✕</button>
                                    </div>
                                    <div className="comments-list">
                                        {reels.find(r => r._id === showComments.reelId)?.comments?.length > 0 ? (
                                            reels.find(r => r._id === showComments.reelId).comments.map((c, i) => (
                                                <div className="comment-item-container" key={i}>
                                                    <div className="comment-item">
                                                        <div className="comment-content">
                                                            <div className="comment-user">{c.userName}</div>
                                                            <div className="comment-text">{c.text}</div>
                                                            <div className="comment-actions">
                                                                <button onClick={() => handleLikeComment(c._id)} className={c.likedBy?.includes(user.id) ? "active" : ""}>
                                                                    {c.likedBy?.includes(user.id) ? "❤️" : "🤍"} {c.likedBy?.length || 0}
                                                                </button>
                                                                <button onClick={() => setReplyTo({ commentId: c._id, userName: c.userName })}>Reply</button>
                                                                {(user.id === c.userId || user.role === "creator") && (
                                                                    <button onClick={() => handleDeleteComment(c._id)} className="delete-btn">Delete</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {c.replies?.length > 0 && (
                                                        <div className="replies-list">
                                                            {c.replies.map((reply, ri) => (
                                                                <div className="reply-item" key={ri}>
                                                                    <div className="comment-user">{reply.userName}</div>
                                                                    <div className="comment-text">{reply.text}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="no-comments">No comments yet. Be the first!</p>
                                        )}
                                    </div>
                                    <form className="comment-input-area" onSubmit={handleComment}>
                                        {replyTo && (
                                            <div className="replying-to">
                                                Replying to @{replyTo.userName}
                                                <button type="button" onClick={() => setReplyTo(null)}>✕</button>
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                        />
                                        <button type="submit" disabled={!newComment.trim()}>Post</button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ORDERS TAB - remains the same */}
                {activeTab === "orders" && (
                    <div>
                        {activeOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16 }}>
                                    🔥 Active Orders
                                </h2>
                                <div className="orders-list" style={{ marginBottom: 40 }}>
                                    {activeOrders.map((order) => (
                                        <div className="order-card" key={order._id}>
                                            {/* ... order card content remains unchanged ... */}
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-restaurant">🏪 {order.restaurantName}</div>
                                                    <div className="order-time">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className={`order-status status-${order.status === "cancel_requested" ? "rejected" : order.status}`}>
                                                    {order.status === "cancel_requested" ? "Cancellation Pending" : formatStatus(order.status)}
                                                </span>
                                            </div>
                                            {order.status === "cancel_requested" && (
                                                <div className="rejection-reason" style={{ margin: "0 16px 16px", color: "#fca5a5", background: "rgba(239, 68, 68, 0.05)", fontSize: "0.85rem", textAlign: "center" }}>
                                                    ⏳ Your cancellation request is pending operator approval.
                                                </div>
                                            )}

                                            <div className="tracking-progress">
                                                {TRACKING_STEPS.map((step, i) => (
                                                    <span key={step.key} style={{ display: "contents" }}>
                                                        <div className={`tracking-step ${getStepState(order, step.key)}`}>
                                                            <div className="tracking-dot">{step.icon}</div>
                                                            <div className="tracking-label">{step.label}</div>
                                                        </div>
                                                        {i < TRACKING_STEPS.length - 1 && (
                                                            <div
                                                                className={`tracking-line ${getStepState(order, step.key) === "completed" ? "completed" : ""
                                                                    }`}
                                                            />
                                                        )}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="order-items">
                                                {order.items.map((item, i) => (
                                                    <div className="order-item" key={i}>
                                                        <div className="order-item-left">
                                                            {item.image && (
                                                                <img
                                                                    src={`${CONFIG.UPLOADS_BASE}${item.image}`}
                                                                    alt={item.name}
                                                                    className="order-item-img"
                                                                />
                                                            )}
                                                            <div>
                                                                <div className="order-item-name">{item.name}</div>
                                                                <div className="order-item-qty">Qty: {item.quantity}</div>
                                                            </div>
                                                        </div>
                                                        <div className="order-item-price">₹{item.price * item.quantity}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="order-footer">
                                                <div className="order-total">
                                                    <span>Total</span>₹{order.totalAmount}
                                                </div>
                                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                    {(order.status === "pending" || order.status === "confirmed") && (
                                                        <button
                                                            className="btn-status"
                                                            style={{ padding: "8px 12px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", fontSize: "12px", fontWeight: "700" }}
                                                            onClick={() => setCancellationModal({ show: true, orderId: order._id, reason: "" })}
                                                        >
                                                            Cancel Order
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {pastOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16 }}>
                                    📋 Order History
                                </h2>
                                <div className="orders-list">
                                    {pastOrders.map((order) => (
                                        <div className="order-card" key={order._id} style={{ opacity: 0.7 }}>
                                            {/* ... past order content ... */}
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-restaurant">🏪 {order.restaurantName}</div>
                                                    <div className="order-time">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className={`order-status status-${order.status}`}>
                                                    {formatStatus(order.status)}
                                                </span>
                                            </div>
                                            <div className="order-items">
                                                {order.items.map((item, i) => (
                                                    <div className="order-item" key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "12px" }}>
                                                        <div className="order-item-left">
                                                            <div>
                                                                <div className="order-item-name">{item.name}</div>
                                                                <div className="order-item-qty">Qty: {item.quantity}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                                                            <div className="order-item-price">₹{item.price * item.quantity}</div>
                                                            {order.status === "delivered" && (
                                                                <button
                                                                    className="btn-status"
                                                                    style={{ padding: "4px 10px", fontSize: "10px", borderRadius: "8px" }}
                                                                    onClick={() => setRatingModal({ show: true, item: item, orderId: order._id })}
                                                                >
                                                                    ⭐ Rate Item
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="order-total">
                                                <span>Total</span>₹{order.totalAmount}
                                            </div>


                                            {order.status === "rejected" && order.rejectionReason && (
                                                <div className="rejection-reason">
                                                    Reason: {order.rejectionReason}
                                                </div>
                                            )}
                                            {order.status === "cancelled" && order.cancellationReason && (
                                                <div className="rejection-reason" style={{ color: "#fca5a5", background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.1)" }}>
                                                    Cancellation Reason: {order.cancellationReason}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {orders.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">📦</div>
                                <div className="empty-title">No Orders Yet</div>
                                <div className="empty-desc">Browse restaurants and place your first order!</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CART FAB & PANEL */}
            {activeTab === "browse" && cart.length > 0 && (
                <button className="cart-fab" onClick={() => setShowCart(true)}>
                    🛒
                    <span className="cart-fab-badge">{cart.length}</span>
                </button>
            )}

            {showCart && (
                <>
                    <div className="cart-overlay" onClick={() => setShowCart(false)} />
                    <div className="cart-panel">
                        <div className="cart-header">
                            <div className="cart-title">🛒 Your Cart</div>
                            <button className="cart-close" onClick={() => setShowCart(false)}>
                                ✕
                            </button>
                        </div>

                        <div className="cart-items">
                            {cart.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🛒</div>
                                    <div className="empty-title">Cart is empty</div>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div className="cart-item" key={item.menuItemId}>
                                        <div className="cart-item-info">
                                            <div className="cart-item-name">{item.name}</div>
                                            <div className="cart-item-detail">
                                                {item.quantity} × ₹{item.price} • {item.restaurantName}
                                            </div>
                                        </div>
                                        <div className="cart-item-total">₹{item.price * item.quantity}</div>
                                        <button
                                            className="cart-remove"
                                            onClick={() => removeFromCart(item.menuItemId)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div style={{ padding: "0 20px" }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                                    <button
                                        className="btn-nutrition"
                                        style={{ flex: 1, justifyContent: "center", margin: 0 }}
                                        onClick={fetchCartNutrition}
                                        disabled={loadingCartNutrition}
                                    >
                                        {loadingCartNutrition ? "Analysing…" : cartNutrition ? "🔬 Refresh Nutrition" : "🔬 Check Cart Nutrition"}
                                    </button>
                                    {cartNutrition && !loadingCartNutrition && (
                                        <button
                                            className="btn-nutrition"
                                            style={{
                                                margin: 0,
                                                background: 'rgba(244, 63, 94, 0.08)',
                                                borderColor: 'rgba(244, 63, 94, 0.2)',
                                                color: '#fb7185'
                                            }}
                                            onClick={() => setCartNutrition(null)}
                                        >
                                            ✕ Remove
                                        </button>
                                    )}
                                </div>

                                {cartNutrition && (
                                    <div className="nutrition-panel" style={{ margin: "0 0 20px 0", position: 'relative' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                            <div className="nutrition-title" style={{ margin: 0 }}>🥗 Cart Nutrition (AI Estimate)</div>
                                            <button
                                                onClick={() => setCartNutrition(null)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: 'none',
                                                    color: '#9ae6b4',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                    e.currentTarget.style.color = '#fff';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    e.currentTarget.style.color = '#9ae6b4';
                                                }}
                                                title="Close Nutrition Info"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="nutrition-summary">
                                            <div className="nutr-pill orange">🔥 {cartNutrition.totalCalories} kcal</div>
                                            <div className="nutr-pill blue">💪 {cartNutrition.protein} protein</div>
                                            <div className="nutr-pill yellow">🍞 {cartNutrition.carbs} carbs</div>
                                            <div className="nutr-pill red">🧈 {cartNutrition.fat} fat</div>
                                            <div className="nutr-pill green">🌿 {cartNutrition.fiber} fiber</div>
                                        </div>
                                        <div className="nutrition-items">
                                            {cartNutrition.items?.map((ni, i) => (
                                                <div className="nutr-item-row" key={i}>
                                                    <span className="nutr-item-name" style={{ fontSize: "11px" }}>{ni.name}</span>
                                                    <span className="nutr-item-stats" style={{ fontSize: "10px" }}>{ni.calories} kcal · P:{ni.protein}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="cart-footer">
                            <div className="cart-total-row">
                                <div className="cart-total-label">Total Amount</div>
                                <div className="cart-total-amount">₹{cartTotal}</div>
                            </div>
                            <button
                                className="btn-checkout"
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || loading}
                            >
                                {loading ? "Placing Order..." : `Place Order • ₹${cartTotal}`}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* RATING MODAL */}
            {ratingModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-title">⭐ Rate {ratingModal.item.name}</div>
                        <form onSubmit={handleRate}>
                            <div className="modal-body">
                                <p>How was your meal from {ratingModal.item.restaurantName}?</p>
                                <div className="star-rating" style={{ margin: "20px 0", justifyContent: "center" }}>
                                    {[1, 2, 3, 4, 5].map((num) => (
                                        <span
                                            key={num}
                                            className={`star ${userRating >= num ? "active" : ""}`}
                                            onClick={() => setUserRating(num)}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>Optional Comment:</label>
                                <textarea
                                    className="textarea-input"
                                    placeholder="Share your feedback..."
                                    value={userComment}
                                    onChange={(e) => setUserComment(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-icon" onClick={() => setRatingModal({ show: false, item: null })}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? "Submitting..." : "Submit Rating"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CANCELLATION MODAL */}
            {cancellationModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-title">🚫 Cancel Order</div>
                        <div className="modal-body">
                            <p style={{ marginBottom: "15px" }}>Are you sure you want to cancel this order? Please tell us why:</p>
                            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>Reason for cancellation:</label>
                            <textarea
                                className="textarea-input"
                                placeholder="I changed my mind / Ordered by mistake..."
                                value={cancellationModal.reason}
                                onChange={(e) => setCancellationModal({ ...cancellationModal, reason: e.target.value })}
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-icon" onClick={() => setCancellationModal({ show: false, orderId: null, reason: "" })}>Go Back</button>
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ background: "#ef4444" }}
                                onClick={handleCancelOrder}
                                disabled={loading}
                            >
                                {loading ? "Cancelling..." : "Confirm Cancellation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEW PANEL MODAL */}
            {reviewPanel.show && (
                <div className="modal-overlay" onClick={() => setReviewPanel({ show: false, item: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <div className="modal-title" style={{ margin: 0 }}>💬 Reviews: {reviewPanel.item.name}</div>
                            <button className="close-btn" onClick={() => setReviewPanel({ show: false, item: null })} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                            <div className="review-stats" style={{ display: "flex", alignItems: "center", gap: "15px", padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: "12px", marginBottom: "20px" }}>
                                <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ff512f" }}>
                                    {reviewPanel.item.averageRating || "0.0"}
                                </div>
                                <div>
                                    <div className="star-rating">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <span key={n} style={{ color: reviewPanel.item.averageRating >= n ? "#ff512f" : "rgba(255,255,255,0.2)" }}>★</span>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Based on {reviewPanel.item.ratings?.length || 0} reviews</div>
                                </div>
                            </div>

                            <div className="reviews-list" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                {reviewPanel.item.ratings?.length > 0 ? (
                                    reviewPanel.item.ratings.map((r, i) => (
                                        <div key={i} className="review-item" style={{ padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#60a5fa" }}>{r.userName || `User ${r.userId?.slice(-4)}`}</div>
                                                <div style={{ color: "#ff512f", fontSize: "0.8rem" }}>{"★".repeat(r.rating)}</div>
                                            </div>
                                            <div style={{ fontSize: "0.85rem", opacity: 0.8, lineHeight: "1.4", marginBottom: "10px" }}>{r.comment || "No comment left."}</div>

                                            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: r.replies?.length > 0 ? "10px" : "0" }}>
                                                <button
                                                    onClick={() => handleLikeRating(reviewPanel.item._id, r._id)}
                                                    style={{ background: "none", border: "none", color: r.likes?.includes(user.id) ? "#ff512f" : "#fff", cursor: "pointer", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}
                                                >
                                                    {r.likes?.includes(user.id) ? "❤️" : "🤍"} {r.likes?.length || 0}
                                                </button>
                                                <div style={{ fontSize: "0.7rem", opacity: 0.4 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                                            </div>

                                            {/* Operator Replies */}
                                            {r.replies?.length > 0 && (
                                                <div style={{ marginLeft: "10px", paddingLeft: "10px", borderLeft: "2px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
                                                    {r.replies.map((reply, ri) => (
                                                        <div key={ri} style={{ background: "rgba(255,255,255,0.02)", padding: "6px 10px", borderRadius: "8px" }}>
                                                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9ae6b4" }}>{reply.userName}</div>
                                                            <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{reply.text}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
                                        <div style={{ fontSize: "2rem" }}>😶</div>
                                        <p>No reviews yet for this item.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`dash-toast ${toast.type}`}>
                    {toast.type === "success" ? "✅" : "⚠️"} {toast.text}
                </div>
            )}
        </div>
    );
}