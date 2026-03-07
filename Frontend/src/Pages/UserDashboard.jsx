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
    const [paymentMethod, setPaymentMethod] = useState("cod"); // "cod" | "upi"
    const [upiModal, setUpiModal] = useState({ show: false, orderId: null, amount: 0 });
    const [pendingCheckoutData, setPendingCheckoutData] = useState(null);
    const [foodTypeFilter, setFoodTypeFilter] = useState("all"); // "all" | "veg" | "non-veg"
    const [studentVerified, setStudentVerified] = useState(false); // true if verified & not expired
    const [studentInfo, setStudentInfo] = useState(null);        // { institutionName, idExpiryDate }
    const [applyStudentDiscount, setApplyStudentDiscount] = useState(false);
    const [studentModal, setStudentModal] = useState(false);     // show ID upload modal
    const [studentForm, setStudentForm] = useState({ institutionName: "", idExpiryDate: "", file: null });
    const [studentLoading, setStudentLoading] = useState(false);
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [instructions, setInstructions] = useState("");
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const orderStatusRef = useRef({});

    const user = JSON.parse(localStorage.getItem(CONFIG.dataKey("user")) || "{}");
    const token = localStorage.getItem(CONFIG.tokenKey("user"));

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
                // Shuffle client-side too for extra randomness
                const shuffled = [...data.data].sort(() => Math.random() - 0.5);
                setReels(shuffled);
                setDisplayReels([...shuffled, ...shuffled, ...shuffled]);
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

    const handleFollow = async (creatorId) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/creator/${creatorId}/follow`, {
                method: "POST",
                headers: authHeaders()
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", data.message);
                const updatedUser = {
                    ...user, following: data.isFollowing
                        ? [...(user.following || []), creatorId]
                        : (user.following || []).filter(id => id !== creatorId)
                };
                localStorage.setItem(CONFIG.dataKey("user"), JSON.stringify(updatedUser));
                setDisplayReels(prev => [...prev]);
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Failed to follow creator");
        }
    };

    const openCreatorProfile = (creatorId) => {
        if (!creatorId) return;
        navigate(`/creator-profile/${creatorId}`);
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

    const fetchMenu = useCallback(async (isSilent = false) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu`);
            const data = await res.json();
            if (data.success) {
                setMenuItems(data.data);
                // Also update the review panel item if it's currently open
                if (reviewPanel?.show && reviewPanel?.item) {
                    const updatedItem = data.data.find(i => i._id === reviewPanel.item._id);
                    if (updatedItem) {
                        setReviewPanel(prev => ({ ...prev, item: updatedItem }));
                    }
                }
            }
        } catch {
            if (!isSilent) showToast("error", "Failed to load menu");
        }
    }, [reviewPanel?.show, reviewPanel?.item]);

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

    // ─── Post-Checkout & Tab Effects ───

    // 1. Scroll to top when tab changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [activeTab]);

    // 2. Refresh orders immediately when switching to the orders tab
    useEffect(() => {
        if (activeTab === "orders" && token) {
            fetchOrders(true);
        }
    }, [activeTab, fetchOrders, token]);

    // 3. Body scroll lock when cart or major modals are open
    useEffect(() => {
        if (showCart || studentModal || ratingModal.show || upiModal.show) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [showCart, studentModal, ratingModal.show, upiModal.show]);

    // 4. Local role protection
    useEffect(() => {
        if (!token || user.role !== "user") {
            navigate("/");
        }
    }, [token, user.role, navigate]);

    const fetchUserProfile = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/auth/me`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                if (data.data.phone) setPhone(data.data.phone);
                if (data.data.address) setAddress(data.data.address);
            }
        } catch { /* silent */ }
    }, [token, authHeaders]);

    useEffect(() => {
        fetchMenu();
        fetchReels();
        fetchOrders();
        fetchStudentStatus();
        fetchUserProfile();
        const interval = setInterval(() => {
            fetchOrders(true);
            fetchMenu(true);
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchMenu, fetchReels, fetchOrders, fetchUserProfile]);

    const fetchStudentStatus = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/student/status`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success && data.studentStatus === "verified") {
                const expiry = new Date(data.idExpiryDate);
                if (expiry > new Date()) {
                    setStudentVerified(true);
                    setStudentInfo({ institutionName: data.institutionName, idExpiryDate: expiry });
                } else {
                    setStudentVerified(false);
                    setStudentInfo(null);
                }
            } else {
                setStudentVerified(false);
                setStudentInfo(null);
            }
        } catch { /* silent */ }
    };

    const handleStudentVerify = async (e) => {
        e.preventDefault();
        if (!studentForm.file) { showToast("error", "Please select your student ID image"); return; }
        if (!studentForm.institutionName) { showToast("error", "Please enter your institution name"); return; }
        if (!studentForm.idExpiryDate) { showToast("error", "Please enter the ID expiry date"); return; }
        setStudentLoading(true);
        try {
            const fd = new FormData();
            fd.append("studentId", studentForm.file);
            fd.append("institutionName", studentForm.institutionName);
            fd.append("idExpiryDate", studentForm.idExpiryDate);
            const res = await fetch(`${CONFIG.API_BASE}/student/verify`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", data.message);
                setStudentModal(false);
                setStudentForm({ institutionName: "", idExpiryDate: "", file: null });
                await fetchStudentStatus();
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", "Verification failed. Please try again.");
        } finally {
            setStudentLoading(false);
        }
    };

    const handleRevokeStudent = async () => {
        if (!window.confirm("Remove your student verification?")) return;
        try {
            await fetch(`${CONFIG.API_BASE}/student/revoke`, { method: "DELETE", headers: authHeaders() });
            setStudentVerified(false);
            setStudentInfo(null);
            setApplyStudentDiscount(false);
            showToast("info", "Student verification removed.");
        } catch { showToast("error", "Failed to revoke."); }
    };

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

    // Filter restaurants based on search and food type
    const filteredRestaurants = restaurantGroups.filter((group) => {
        // First filter by food type if not "all"
        if (foodTypeFilter !== "all") {
            if (foodTypeFilter === "veg") {
                // Strict: Hide if restaurant has ANY non-veg items
                const isPureVeg = !group.items.some(item => item.foodType === "non-veg");
                if (!isPureVeg) return false;
            } else if (foodTypeFilter === "non-veg") {
                // Standard: Show restaurants that actually serve non-veg
                const hasNonVeg = group.items.some(item => item.foodType === "non-veg");
                if (!hasNonVeg) return false;
            }
        }

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
            // Filter by food type
            if (foodTypeFilter !== "all") {
                if (item.foodType !== foodTypeFilter && item.foodType !== "both") return false;
            }

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
        setInstructions(""); // Clear instructions for new item context
        showToast("success", `${item.name} added to cart!`);
    };

    const removeFromCart = (menuItemId) => {
        const newCart = cart.filter((c) => c.menuItemId !== menuItemId);
        setCart(newCart);
        setCartNutrition(null);
        if (newCart.length === 0) setInstructions(""); // Clear if cart is now empty
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = applyStudentDiscount && studentVerified ? Math.round(cartTotal * 0.20) : 0;
    const discountedTotal = cartTotal - discountAmount;

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!phone.trim()) { showToast("error", "Please enter your phone number."); return; }
        if (!address.trim()) { showToast("error", "Please enter your delivery address."); return; }

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

            // --- UPI: show payment modal before creating orders ---
            if (paymentMethod === "upi") {
                setPendingCheckoutData(grouped);
                setUpiModal({ show: true, orderId: null, amount: discountedTotal });
                setLoading(false);
                return;
            }

            // --- COD: place orders directly ---
            const orderIds = await placeOrders(grouped, "cod");
            if (orderIds) {
                showToast("success", "Order placed successfully! 🎉");
                setCart([]);
                setInstructions(""); // Reset instructions after order
                setShowCart(false);
                setActiveTab("orders");
                fetchOrders();
            }
        } catch (err) {
            showToast("error", "Failed to place order");
        } finally {
            setLoading(false);
        }
    };

    // Shared order creation helper used by both COD and UPI flows
    const placeOrders = async (grouped, method) => {
        const placedOrderIds = [];
        for (const group of Object.values(grouped)) {
            const res = await fetch(`${CONFIG.API_BASE}/orders`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    operatorId: group.operatorId,
                    restaurantName: group.restaurantName,
                    items: group.items,
                    paymentMethod: method,
                    applyStudentDiscount: applyStudentDiscount && studentVerified,
                    phone: phone.trim(),
                    address: address.trim(),
                    instructions: instructions.trim(),
                }),
            });
            const data = await res.json();
            if (!data.success) {
                showToast("error", data.message || "Order failed");
                return null;
            }
            placedOrderIds.push(data.data._id);
        }
        return placedOrderIds;
    };

    // Called when user clicks "Confirm Payment" in the UPI modal
    const handleUpiConfirm = async () => {
        if (!pendingCheckoutData) return;
        setLoading(true);
        try {
            const orderIds = await placeOrders(pendingCheckoutData, "upi");
            if (!orderIds) { setLoading(false); return; }

            // Mark each new order as paid via the /pay endpoint
            for (const id of orderIds) {
                await fetch(`${CONFIG.API_BASE}/orders/${id}/pay`, {
                    method: "PUT",
                    headers: authHeaders(),
                });
            }

            showToast("success", "UPI Payment confirmed! Order placed 🎉");
            setCart([]);
            setInstructions(""); // Reset instructions after order
            setShowCart(false);
            setUpiModal({ show: false, orderId: null, amount: 0 });
            setPendingCheckoutData(null);
            setActiveTab("orders");
            fetchOrders();
        } catch {
            showToast("error", "Payment failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const openRatingModal = (item, orderId) => {
        const menuItem = menuItems.find(m => m._id === item.menuItemId);
        // Find existing rating specifically for THIS order
        const existingRating = menuItem?.ratings?.find(r =>
            r.userId === user.id && r.orderId === orderId
        );

        if (existingRating) {
            setUserRating(existingRating.rating);
            setUserComment(existingRating.comment || "");
        } else {
            setUserRating(5);
            setUserComment("");
        }

        setRatingModal({
            show: true,
            item: { ...item, restaurantName: menuItem?.restaurantName || item.restaurantName },
            orderId
        });
    };

    const handleRate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/${ratingModal.item.menuItemId}/rate`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    rating: userRating,
                    comment: userComment,
                    orderId: ratingModal.orderId
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "Thanks for your rating! ⭐");
                setRatingModal({ show: false, item: null, orderId: null });
                setUserRating(5);
                setUserComment("");
                // Immediate state sync for local UI
                if (data.data) {
                    setMenuItems(prev => prev.map(item => item._id === data.data._id ? data.data : item));
                    if (reviewPanel?.item?._id === data.data._id) {
                        setReviewPanel(prev => ({ ...prev, item: data.data }));
                    }
                }
                fetchMenu(); // Final refresh
            } else {
                console.warn("Rating Error:", data.message);
                showToast("error", data.message || "Failed to submit rating");
            }
        } catch (err) {
            console.error("Rating Submission Error:", err);
            showToast("error", "Failed to submit rating. Check console.");
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
        setLoading(false);
        localStorage.removeItem(CONFIG.tokenKey("user"));
        localStorage.removeItem(CONFIG.dataKey("user"));
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
                <div className="dash-brand">🍕 <span>FoodMenia</span></div>
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
            <div className={`dash-content ${activeTab === 'reels' ? 'reels-tab-active' : ''}`}>
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

                        <div className="search-filter-row">
                            <div className="search-bar">
                                <input
                                    className="search-input"
                                    type="text"
                                    placeholder="Search restaurants or dishes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="food-type-filter">
                                <button
                                    className={`filter-btn ${foodTypeFilter === "all" ? "active" : ""}`}
                                    onClick={() => setFoodTypeFilter("all")}
                                >
                                    Both
                                </button>
                                <button
                                    className={`filter-btn veg ${foodTypeFilter === "veg" ? "active" : ""}`}
                                    onClick={() => setFoodTypeFilter("veg")}
                                >
                                    🟢 Veg
                                </button>
                                <button
                                    className={`filter-btn non-veg ${foodTypeFilter === "non-veg" ? "active" : ""}`}
                                    onClick={() => setFoodTypeFilter("non-veg")}
                                >
                                    🔴 Non-Veg
                                </button>
                            </div>
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
                                                <div className="restaurant-banner-tags">
                                                    {group.items.some(i => i.foodType === 'veg' || i.foodType === 'both') && <span className="tag-veg">Veg</span>}
                                                    {group.items.some(i => i.foodType === 'non-veg' || i.foodType === 'both') && <span className="tag-non-veg">Non-Veg</span>}
                                                </div>
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
                                                {item.isBestSeller && (
                                                    <div className="best-seller-badge">🔥 Best Seller</div>
                                                )}
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
                                                    <div className="food-card-header">
                                                        <div className={`food-dot ${item.foodType}`}></div>
                                                        <div className="food-card-name">{item.name}</div>
                                                    </div>
                                                    <div className="avg-rating cursor-pointer"
                                                        onClick={() => setReviewPanel({ show: true, item: item })}
                                                        title="View Reviews">
                                                        <span className="star">★</span> {item.averageRating || "0.0"}
                                                        <span className="text-xs opacity-70">({item.ratings?.length || 0})</span>
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
                    <div className="reels-container" tabIndex="0">
                        {displayReels.length > 0 ? (
                            <div className="reels-feed">
                                {displayReels.map((reel, idx) => (
                                    <div className="reel-card" key={`${reel._id}-${idx}`}>
                                        <video
                                            key={reel._id}
                                            src={reel.videoUrl.startsWith("http") ? reel.videoUrl : `${CONFIG.UPLOADS_BASE}${reel.videoUrl.startsWith("/") ? "" : "/"}${reel.videoUrl}`}
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
                                                <div className="reel-creator-row flex align-center gap-10 mb-10">
                                                    <div className="reel-avatar-wrap">
                                                        <div className="reel-avatar-inner">
                                                            {reel.creatorId?.profilePic ? (
                                                                <img
                                                                    src={`${CONFIG.UPLOADS_BASE}${reel.creatorId.profilePic}`}
                                                                    alt=""
                                                                    className="reel-avatar-img"
                                                                />
                                                            ) : (
                                                                <div className="reel-avatar-fallback">
                                                                    {reel.creatorId?.fullName?.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="reel-creator cursor-pointer font-bold"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openCreatorProfile(reel.creatorId?._id, reel.creatorId?.fullName);
                                                        }}
                                                    >
                                                        {reel.creatorId?.fullName?.replace(/\s+/g, "").toLowerCase()}
                                                    </div>
                                                    {user.id !== reel.creatorId?._id && (
                                                        <button
                                                            className={`btn-follow-pill ${user.following?.includes(reel.creatorId?._id) ? "following" : ""}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFollow(reel.creatorId?._id);
                                                            }}
                                                        >
                                                            {user.following?.includes(reel.creatorId?._id) ? "Following" : "Follow"}
                                                        </button>
                                                    )}
                                                </div>
                                                <h3 className="reel-title">{reel.title}</h3>
                                                <div className="reel-meta-row flex align-center gap-12 mb-12">
                                                    <span className="reel-views-pill">👁️ {reel.views || 0} views</span>
                                                    <span className="reel-restaurant-pill">🏪 {reel.restaurantId?.restaurantName}</span>
                                                </div>
                                                <p className="reel-description">{reel.description}</p>
                                            </div>
                                            <div className="reel-actions">
                                                <button className="reel-action-btn" onClick={() => handleLike(reel._id)}>
                                                    <span className={`icon ${reel.likedBy?.includes(user.id) ? "text-brand-important" : "text-white"}`}>
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
                                <h2 className="section-title mb-16">
                                    🔥 Active Orders
                                </h2>
                                <div className="orders-list mb-32">
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
                                                <div className="rejection-reason m-x-16 mb-16 text-danger-light bg-glass-light text-sm text-center">
                                                    ⏳ Your cancellation request is pending operator approval.
                                                </div>
                                            )}

                                            <div className="tracking-progress">
                                                {TRACKING_STEPS.map((step, i) => (
                                                    <span key={step.key} className="flex-contents">
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
                                                <div className="order-total-container">
                                                    <div className="order-total">
                                                        <span>Total</span>
                                                        {order.studentDiscountApplied ? (
                                                            <div className="flex align-center gap-8">
                                                                <s style={{ opacity: 0.4, fontSize: 13 }}>₹{order.totalAmount + (order.discountAmount || 0)}</s>
                                                                <span>₹{order.totalAmount}</span>
                                                            </div>
                                                        ) : (
                                                            <span>₹{order.totalAmount}</span>
                                                        )}
                                                    </div>
                                                    {order.studentDiscountApplied && (
                                                        <div className="order-student-badge">
                                                            🎓 20% Student Off
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Payment status badge */}
                                                <span className={`payment-badge ${order.paymentStatus}`}>
                                                    {order.paymentMethod?.toUpperCase()} • {order.paymentStatus === "paid" ? "✅ Paid" : order.paymentStatus === "refunded" ? "🔄 Refunded" : "⏳ Unpaid"}
                                                </span>

                                                <div className="flex align-center gap-8">
                                                    {(order.status === "pending" || order.status === "confirmed") && (
                                                        <button
                                                            className="btn-status btn-danger-soft"
                                                            onClick={() => setCancellationModal({ show: true, orderId: order._id, reason: "" })}
                                                        >
                                                            Cancel Order
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* OTP Box — only shown when out for delivery */}
                                            {order.status === "out_for_delivery" && order.deliveryOTP && (
                                                <div className="otp-card">
                                                    <div>
                                                        <div className="otp-label">Delivery OTP</div>
                                                        <div className="otp-desc">
                                                            Share this code with the delivery person to confirm receipt.
                                                        </div>
                                                    </div>
                                                    <div className="otp-code">
                                                        {order.deliveryOTP}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {pastOrders.length > 0 && (
                            <>
                                <h2 className="section-title mb-16">
                                    📋 Order History
                                </h2>
                                <div className="orders-list">
                                    {pastOrders.map((order) => (
                                        <div className="order-card opacity-70" key={order._id}>
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
                                                    <div className="order-item border-bottom-glass pb-12" key={i}>
                                                        <div className="order-item-left">
                                                            <div>
                                                                <div className="order-item-name">{item.name}</div>
                                                                <div className="order-item-qty">Qty: {item.quantity}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-col align-end gap-2">
                                                            <div className="order-item-price">₹{item.price * item.quantity}</div>
                                                            {order.status === "delivered" && (
                                                                <button
                                                                    className="btn-status py-4 px-10 text-xs rounded-8"
                                                                    onClick={() => openRatingModal(item, order._id)}
                                                                >
                                                                    ⭐ Rate Item
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="order-footer">
                                                <div className="order-total-container">
                                                    <div className="order-total">
                                                        <span>Total</span>
                                                        {order.studentDiscountApplied ? (
                                                            <div className="flex align-center gap-8">
                                                                <s style={{ opacity: 0.4, fontSize: 13 }}>₹{order.totalAmount + (order.discountAmount || 0)}</s>
                                                                <span>₹{order.totalAmount}</span>
                                                            </div>
                                                        ) : (
                                                            <span>₹{order.totalAmount}</span>
                                                        )}
                                                    </div>
                                                    {order.studentDiscountApplied && (
                                                        <div className="order-student-badge">
                                                            🎓 20% Student Off
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`payment-badge ${order.paymentStatus}`}>
                                                    {order.paymentMethod?.toUpperCase()} • {order.paymentStatus === "paid" ? "✅ Paid" : order.paymentStatus === "refunded" ? "🔄 Refunded" : "⏳ Unpaid"}
                                                </span>
                                            </div>


                                            {order.status === "rejected" && order.rejectionReason && (
                                                <div className="rejection-reason">
                                                    Reason: {order.rejectionReason}
                                                </div>
                                            )}
                                            {order.status === "cancelled" && order.cancellationReason && (
                                                <div className="rejection-reason text-danger-light bg-glass-light border-danger-light">
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

                        <div className="cart-body">
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
                                <>
                                    <div className="px-20">
                                        <div className="flex gap-8 mb-16">
                                            <button
                                                className="btn-nutrition flex-grow flex-center m-0"
                                                onClick={fetchCartNutrition}
                                                disabled={loadingCartNutrition}
                                            >
                                                {loadingCartNutrition ? "Analysing…" : cartNutrition ? "🔬 Refresh Nutrition" : "🔬 Check Cart Nutrition"}
                                            </button>
                                            {cartNutrition && !loadingCartNutrition && (
                                                <button
                                                    className="btn-nutrition m-0 btn-danger-soft"
                                                    onClick={() => setCartNutrition(null)}
                                                >
                                                    ✕ Remove
                                                </button>
                                            )}
                                        </div>

                                        {cartNutrition && (
                                            <div className="nutrition-panel m-0 relative">
                                                <div className="flex-between mb-12">
                                                    <div className="nutrition-title m-0">🥗 Cart Nutrition (AI Estimate)</div>
                                                    <button
                                                        onClick={() => setCartNutrition(null)}
                                                        className="btn-icon-close"
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
                                                            <span className="nutr-item-name text-xs">{ni.name}</span>
                                                            <span className="nutr-item-stats text-xs">{ni.calories} kcal · P:{ni.protein}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Student Discount Section (Now inside scrollable body) */}
                                    <div className="px-20 mt-16">
                                        <div className="student-discount-section">
                                            <div className="student-discount-row">
                                                <div className="student-discount-info">
                                                    <span className="student-icon">🎓</span>
                                                    <div>
                                                        <div className="student-label">Student Discount (20% off)</div>
                                                        {studentVerified ? (
                                                            <div className="student-inst">{studentInfo?.institutionName}</div>
                                                        ) : (
                                                            <div className="student-not-verified">
                                                                Not verified —{" "}
                                                                <button className="student-link-btn" onClick={() => setStudentModal(true)}>
                                                                    Verify ID
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {studentVerified ? (
                                                    <label className="student-toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={applyStudentDiscount}
                                                            onChange={(e) => setApplyStudentDiscount(e.target.checked)}
                                                        />
                                                        <span className="toggle-track">
                                                            <span className="toggle-thumb" />
                                                        </span>
                                                    </label>
                                                ) : (
                                                    <button className="student-verify-btn" onClick={() => setStudentModal(true)}>
                                                        Verify
                                                    </button>
                                                )}
                                            </div>

                                            {studentVerified && (
                                                <button className="student-revoke-link" onClick={handleRevokeStudent}>
                                                    🗑 Remove verification
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Delivery Details Section */}
                                    <div className="px-20 mt-20">
                                        <div className="delivery-details-card">
                                            <div className="flex-between mb-16">
                                                <div className="delivery-title">📍 Delivery Details</div>
                                                {(phone || address) && !isEditingAddress && (
                                                    <button
                                                        className="delivery-edit-btn"
                                                        onClick={() => setIsEditingAddress(true)}
                                                    >
                                                        <span>✏️ Edit</span>
                                                    </button>
                                                )}
                                            </div>

                                            {(!phone || !address || isEditingAddress) ? (
                                                <div className="flex-col gap-5">
                                                    <input
                                                        type="text"
                                                        placeholder="Phone Number"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        className="student-input"
                                                    />
                                                    <textarea
                                                        placeholder="Complete Delivery Address"
                                                        value={address}
                                                        onChange={(e) => setAddress(e.target.value)}
                                                        className="student-input"
                                                        style={{ minHeight: '100px', resize: 'none' }}
                                                    />
                                                    {isEditingAddress && (
                                                        <button className="btn-nutrition py-8 w-100 font-700" onClick={() => setIsEditingAddress(false)}>
                                                            ✅ Save & Use This Address
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="saved-address-box">
                                                    <div className="saved-phone">📞 {phone}</div>
                                                    <div className="saved-address">🏠 {address}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Order Instructions Section */}
                                    <div className="px-20 mt-20 mb-20">
                                        <div className="instructions-card">
                                            <div className="delivery-title mb-12">📝 Special Instructions</div>
                                            <textarea
                                                placeholder="e.g. Add extra cheese, use fresh dough, no onions... (Extra charges may apply)"
                                                value={instructions}
                                                onChange={(e) => setInstructions(e.target.value)}
                                                className="instructions-input"
                                            />
                                        </div>
                                    </div>

                                    {/* Checkout Details (Now Scrollable) */}
                                    <div className="cart-footer-scrollable">
                                        {/* Pricing Breakdown */}
                                        <div className="cart-total-row">
                                            <div className="cart-total-label">Subtotal</div>
                                            <div className="cart-total-amount">₹{cartTotal}</div>
                                        </div>
                                        {applyStudentDiscount && studentVerified && (
                                            <div className="cart-discount-row">
                                                <div className="cart-discount-label">🎓 Student Discount (20%)</div>
                                                <div className="cart-discount-amount">- ₹{discountAmount}</div>
                                            </div>
                                        )}
                                        <div className="cart-total-row cart-grand-total">
                                            <div className="cart-total-label" style={{ fontWeight: 900 }}>Total Payable</div>
                                            <div className="cart-total-amount">{applyStudentDiscount && studentVerified ? <><s style={{ opacity: 0.4, fontSize: 14 }}>₹{cartTotal}</s> ₹{discountedTotal}</> : `₹${cartTotal}`}</div>
                                        </div>

                                        {/* Payment method selector */}
                                        <div className="ud-payment-section">
                                            <div className="ud-payment-label">Payment Method</div>
                                            <div className="ud-payment-methods">
                                                {["cod", "upi"].map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setPaymentMethod(m)}
                                                        className={`ud-payment-btn ${paymentMethod === m ? "active" : ""}`}
                                                    >
                                                        {m === "cod" ? "💵 Cash on Delivery" : "📱 UPI Payment"}
                                                    </button>
                                                ))}
                                            </div>
                                            {paymentMethod === "upi" && (
                                                <div className="ud-upi-info">
                                                    ⚡ You'll confirm payment before the order is placed.
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            className="btn-checkout"
                                            onClick={handleCheckout}
                                            disabled={cart.length === 0 || loading}
                                        >
                                            {loading ? "Processing..." : paymentMethod === "upi" ? `Pay via UPI • ₹${discountedTotal}` : `Place Order (COD) • ₹${discountedTotal}`}
                                        </button>
                                    </div>
                                </>
                            )}
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
                                <p className="mb-16 opacity-70">How was your meal from {ratingModal.item.restaurantName}?</p>
                                <div className="star-rating-box mb-24">
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
                                <label className="ud-modal-label">Optional Comment:</label>
                                <textarea
                                    className="textarea-input"
                                    placeholder="Share your feedback..."
                                    value={userComment}
                                    onChange={(e) => setUserComment(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions gap-12">
                                <button type="button" className="btn-secondary" onClick={() => setRatingModal({ show: false, item: null })}>Cancel</button>
                                <button type="submit" className="btn-primary flex-grow" disabled={loading}>
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
                            <p className="ud-mb-15">Are you sure you want to cancel this order? Please tell us why:</p>
                            <label className="ud-modal-label">Reason for cancellation:</label>
                            <textarea
                                className="textarea-input"
                                placeholder="I changed my mind / Ordered by mistake..."
                                value={cancellationModal.reason}
                                onChange={(e) => setCancellationModal({ ...cancellationModal, reason: e.target.value })}
                            />
                        </div>
                        <div className="modal-actions gap-12">
                            <button type="button" className="btn-secondary" onClick={() => setCancellationModal({ show: false, orderId: null, reason: "" })}>Go Back</button>
                            <button
                                type="button"
                                className="btn-primary btn-danger flex-grow"
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
                    <div className="modal-content max-w-500" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header flex-between mb-24">
                            <div className="modal-title m-0">💬 Reviews: {reviewPanel.item.name}</div>
                            <button className="close-btn" onClick={() => setReviewPanel({ show: false, item: null })}>✕</button>
                        </div>
                        <div className="modal-body max-h-60vh overflow-y-auto">
                            <div className="review-stats-card">
                                <div className="review-avg-num">
                                    {reviewPanel.item.averageRating || "0.0"}
                                </div>
                                <div>
                                    <div className="star-rating flex gap-4">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <span key={n} className={reviewPanel.item.averageRating >= n ? "text-amber" : "text-muted"}>★</span>
                                        ))}
                                    </div>
                                    <div className="text-xs text-muted">Based on {reviewPanel.item.ratings?.length || 0} reviews</div>
                                </div>
                            </div>

                            <div className="reviews-list-container">
                                {reviewPanel.item.ratings?.length > 0 ? (
                                    reviewPanel.item.ratings.map((r, i) => (
                                        <div key={i} className="review-item-card">
                                            <div className="flex-between mb-8">
                                                <div className="review-user-name">{r.userName || `User ${r.userId?.slice(-4)}`}</div>
                                                <div className="text-amber text-sm">{"★".repeat(r.rating)}</div>
                                            </div>
                                            <div className="review-text">{r.comment || "No comment left."}</div>

                                            <div className={`flex align-center gap-12 ${r.replies?.length > 0 ? "mb-16" : "m-0"}`}>
                                                <button
                                                    onClick={() => handleLikeRating(reviewPanel.item._id, r._id)}
                                                    className={`btn-icon-text text-xs flex align-center gap-4 ${r.likes?.includes(user.id) ? "text-brand" : "opacity-50"}`}
                                                >
                                                    {r.likes?.includes(user.id) ? "❤️" : "🤍"} {r.likes?.length || 0}
                                                </button>
                                                <div className="text-xs opacity-30">{new Date(r.createdAt).toLocaleDateString()}</div>
                                            </div>

                                            {/* Operator Replies */}
                                            {r.replies?.length > 0 && (
                                                <div className="ml-12 pl-12 border-left border-white-10 flex flex-col gap-8">
                                                    {r.replies.map((reply, ri) => (
                                                        <div key={ri} className="bg-white-5 p-10 rounded-12">
                                                            <div className="text-xs font-bold text-success opacity-80 mb-2">{reply.userName}</div>
                                                            <div className="text-sm opacity-70">{reply.text}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-40 opacity-30">
                                        <div className="text-4xl mb-12">😶</div>
                                        <p>No reviews yet for this item.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* UPI PAYMENT MODAL */}
            {upiModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content max-w-400 text-center">
                        <div className="text-6xl mb-16">📱</div>
                        <div className="modal-title mb-24">UPI Payment</div>
                        <div className="modal-body">
                            <div className="payment-card">
                                <div className="text-xs font-bold opacity-30 mb-8 uppercase letter-spacing-1">Pay to</div>
                                <div className="text-lg font-black text-white mb-20">FoodMenia Merchants</div>
                                <div className="text-xs font-bold opacity-30 mb-8 uppercase letter-spacing-1">Amount</div>
                                <div className="payment-amount">₹{upiModal.amount}</div>
                                <div className="simulated-badge mt-24">
                                    🔐 Simulated UPI transaction<br />UPI ID: foodmenia@okaxis
                                </div>
                            </div>
                            <p className="text-sm opacity-50 px-20">
                                Tap <strong className="text-white">Confirm Payment</strong> to simulate completing the UPI transaction securely.
                            </p>
                        </div>
                        <div className="modal-actions gap-12">
                            <button
                                className="btn-secondary"
                                onClick={() => { setUpiModal({ show: false, orderId: null, amount: 0 }); setPendingCheckoutData(null); }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary flex-grow"
                                onClick={handleUpiConfirm}
                                disabled={loading}
                            >
                                {loading ? "Processing..." : "✅ Confirm Payment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* STUDENT ID VERIFICATION MODAL */}
            {studentModal && (
                <div className="modal-overlay" onClick={() => setStudentModal(false)}>
                    <div className="modal-content student-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="student-modal-header">
                            <div className="student-modal-icon">🎓</div>
                            <div>
                                <div className="modal-title m-0">Student Verification</div>
                                <div className="student-modal-sub">Get 20% off on every order</div>
                            </div>
                            <button className="close-btn" onClick={() => setStudentModal(false)}>✕</button>
                        </div>

                        <form className="modal-body" onSubmit={handleStudentVerify}>
                            <div className="student-form-info">
                                <span>📋</span>
                                <p>Upload your valid student ID card. We verify your institution and card validity date.</p>
                            </div>

                            <div className="student-form-group">
                                <label>Institution Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. IIT Delhi, St. Xavier's College..."
                                    value={studentForm.institutionName}
                                    onChange={(e) => setStudentForm({ ...studentForm, institutionName: e.target.value })}
                                    className="student-input"
                                    required
                                />
                            </div>

                            <div className="student-form-group">
                                <label>ID Card Expiry Date *</label>
                                <input
                                    type="date"
                                    min={new Date().toISOString().split("T")[0]}
                                    value={studentForm.idExpiryDate}
                                    onChange={(e) => setStudentForm({ ...studentForm, idExpiryDate: e.target.value })}
                                    className="student-input"
                                    required
                                />
                            </div>

                            <div className="student-form-group">
                                <label>Student ID Card Image *</label>
                                <div className="student-upload-area" onClick={() => document.getElementById("studentIdInput").click()}>
                                    {studentForm.file ? (
                                        <div className="student-file-selected">
                                            <span>📎</span>
                                            <span>{studentForm.file.name}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="student-upload-icon">📸</div>
                                            <div className="student-upload-text">Click to upload ID card photo</div>
                                            <div className="student-upload-hint">JPG, PNG, WEBP accepted</div>
                                        </>
                                    )}
                                    <input
                                        id="studentIdInput"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={(e) => setStudentForm({ ...studentForm, file: e.target.files[0] || null })}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setStudentModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary flex-grow" disabled={studentLoading}>
                                    {studentLoading ? "Verifying..." : "🔍 Verify My ID"}
                                </button>
                            </div>
                        </form>
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