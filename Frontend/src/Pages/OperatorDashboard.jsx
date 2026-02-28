import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/dashboard.css";

import CONFIG from "../utils/config";

export default function OperatorDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("menu");
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        category: "General",
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [rejectionModal, setRejectionModal] = useState({ show: false, orderId: null });
    const [rejectionReason, setRejectionReason] = useState("");
    const [editingItem, setEditingItem] = useState(null);
    const [profitTimeframe, setProfitTimeframe] = useState("month");
    const [customDates, setCustomDates] = useState({ start: "", end: "" });
    const [reviewPanel, setReviewPanel] = useState({ show: false, item: null });
    const knownOrderIds = useRef(new Set());

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token");

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    };

    const authHeaders = useCallback(() => ({
        Authorization: `Bearer ${token}`,
    }), [token]);

    // Fetch menu items
    const fetchMenu = useCallback(async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/my?t=${Date.now()}`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) setMenuItems(data.data);
        } catch {
            showToast("error", "Failed to load menu items");
        }
    }, [authHeaders]);

    // Fetch orders
    const fetchOrders = useCallback(async (isSilent = false) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/operator`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                // Check for new orders
                const newOrders = data.data.filter(o => !knownOrderIds.current.has(o._id));
                if (newOrders.length > 0 && knownOrderIds.current.size > 0) {
                    showToast("info", `🔔 You have ${newOrders.length} new order(s)!`);
                }
                newOrders.forEach(o => knownOrderIds.current.add(o._id));
                setOrders(data.data);
            }
        } catch {
            if (!isSilent) showToast("error", "Failed to load orders");
        }
    }, [authHeaders]);

    useEffect(() => {
        if (!token || user.role !== "operator") {
            navigate("/");
            return;
        }
        fetchMenu();
        fetchOrders();
        // Poll orders every 15s
        const interval = setInterval(() => fetchOrders(true), 15000);
        return () => clearInterval(interval);
    }, [token, user.role, navigate, fetchMenu, fetchOrders]);

    // Add or Update menu item
    const handleSubmitItem = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const fd = new FormData();
            fd.append("name", formData.name);
            fd.append("description", formData.description);
            fd.append("price", formData.price);
            fd.append("category", formData.category);
            const url = editingItem ? `${CONFIG.API_BASE}/menu/${editingItem._id}` : `${CONFIG.API_BASE}/menu`;

            if (imageFile) {
                console.log("📎 Appending new image file:", imageFile.name);
                fd.append("image", imageFile);
            } else {
                console.log("ℹ️ No new image selected, keeping current.");
            }

            console.log("📤 Sending update to:", url);
            const method = editingItem ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });

            const data = await res.json();
            if (data.success) {
                showToast("success", `Menu item ${editingItem ? "updated" : "added"} successfully!`);
                handleCancelEdit();
                fetchMenu();
            } else {
                showToast("error", data.message);
            }
        } catch {
            showToast("error", `Failed to ${editingItem ? "update" : "add"} menu item`);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category || "General"
        });
        setImagePreview(item.image ? `${CONFIG.UPLOADS_BASE}${item.image}` : null);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setFormData({
            name: "",
            description: "",
            price: "",
            category: "General"
        });
        setImageFile(null);
        setImagePreview(null);
        setShowAddForm(false);
    };

    // Delete menu item
    const handleDeleteItem = async (id) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/${id}`, {
                method: "DELETE",
                headers: authHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "Item deleted!");
                fetchMenu();
            }
        } catch {
            showToast("error", "Failed to delete item");
        }
    };



    // Update order status
    const handleUpdateStatus = async (orderId, status, rejectionReason = "") => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/${orderId}/status`, {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ status, rejectionReason }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", `Order ${status.replace(/_/g, " ")}!`);
                fetchOrders();
            }
        } catch {
            showToast("error", "Failed to update order status");
        }
    };

    // Rating Interactions
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

    const handleReplyRating = async (itemId, ratingId, text) => {
        if (!text.trim()) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/${itemId}/rate/${ratingId}/reply`, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "Reply sent!");
                setMenuItems(prev => prev.map(item => item._id === itemId ? data.data : item));
                setReviewPanel(prev => ({ ...prev, item: data.data }));
            }
        } catch {
            showToast("error", "Failed to send reply");
        }
    };

    // Image handler
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        console.log("📁 File selected:", file ? file.name : "None");
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log("🖼️ Image preview generated");
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
    };

    const handleDownloadInvoice = (filteredOrders, stats) => {
        const doc = new jsPDF();
        const { grossRevenue, platformFee, netProfit, timeframe } = stats;

        // --- 1. PREMIUM HEADER ---
        // Dark Top Bar
        doc.setFillColor(31, 41, 55); // Dark Gray/Navy
        doc.rect(0, 0, 210, 50, 'F');

        // Accent Line
        doc.setFillColor(255, 81, 47); // Brand Orange
        doc.rect(0, 48, 210, 2, 'F');

        // Brand Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("FOODMENIA", 15, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 200, 200);
        doc.text("PREMIUM FINANCIAL STATEMENT", 15, 32);

        // Generation Date Header
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(`STATEMENT ID: #FM-${Math.floor(1000 + Math.random() * 9000)}-${timeframe.toUpperCase()}`, 145, 18, { align: 'left' });
        doc.text(`ISSUED ON: ${new Date().toLocaleDateString()}`, 145, 24, { align: 'left' });
        doc.text(`TIME: ${new Date().toLocaleTimeString()}`, 145, 30, { align: 'left' });

        // --- 2. BUSINESS INFO ---
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("RESTAURANT DETAILS", 15, 65);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text(user.restaurantName || "Partner Restaurant", 15, 75);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Operator: ${user.fullName}`, 15, 82);
        doc.text(`Period: ${timeframe.replace("_", " ").toUpperCase()}`, 15, 88);

        // Right side info (Quick Stats)
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(140, 60, 55, 30, 3, 3, 'F');
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "bold");
        doc.text("ORDERS PROCESSED", 145, 72);
        doc.setFontSize(18);
        doc.text(`${filteredOrders.length}`, 145, 83);

        // --- 3. FINANCIAL SUMMARY (CARDS) ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("EXECUTIVE SUMMARY", 15, 110);

        // Gross Card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(15, 115, 55, 35, 2, 2, 'DF');
        doc.setFillColor(255, 81, 47); // Orange dot
        doc.circle(22, 122, 1.5, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.text("GROSS REVENUE", 26, 123);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(14);
        doc.text(`Rs. ${grossRevenue.toLocaleString()}`, 22, 138);

        // Fee Card
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(77, 115, 55, 35, 2, 2, 'DF');
        doc.setFillColor(189, 147, 249); // Purple dot
        doc.circle(84, 122, 1.5, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.text("PLATFORM FEE (5%)", 88, 123);
        doc.setTextColor(189, 147, 249);
        doc.setFontSize(14);
        doc.text(`Rs. ${platformFee.toLocaleString()}`, 84, 138);

        // Net Card
        doc.setFillColor(240, 253, 244); // Light green bg
        doc.setDrawColor(34, 197, 94); // Green border
        doc.roundedRect(139, 115, 56, 35, 2, 2, 'DF');
        doc.setFillColor(34, 197, 94); // Green dot
        doc.circle(146, 122, 1.5, 'F');
        doc.setTextColor(21, 128, 61);
        doc.setFontSize(8);
        doc.text("NET PAYOUT", 150, 123);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`Rs. ${netProfit.toLocaleString()}`, 146, 138);

        // --- 4. ORDER BREAKDOWN TABLE ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("DETAILED ORDER BREAKDOWN", 15, 165);

        const tableData = filteredOrders.map(o => [
            `#${o._id.slice(-8).toUpperCase()}`,
            o.items.map(item => `${item.name} (${item.quantity})`).join(", "),
            new Date(o.createdAt).toLocaleDateString(),
            `Rs. ${o.totalAmount.toLocaleString()}`,
            `- Rs. ${(o.totalAmount * 0.05).toFixed(2)}`,
            `Rs. ${(o.totalAmount * 0.95).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 170,
            head: [['ORDER ID', 'ITEMS & QTY', 'DATE', 'GROSS', 'FEE (5%)', 'NET PROFIT']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [31, 41, 55],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [55, 65, 81]
            },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 70 },
                3: { halign: 'right' },
                4: { halign: 'right', textColor: [239, 68, 68] },
                5: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] }
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 15, right: 15 }
        });

        // --- 5. FOOTER & PAGINATION ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Decorative line
            doc.setDrawColor(229, 231, 235);
            doc.line(15, 275, 195, 275);

            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text("Thank you for partnering with FoodMenia. This statement is electronically generated and does not require a signature.", 105, 282, { align: "center" });
            doc.setFont("helvetica", "bold");
            doc.text(`PAGE ${i} OF ${pageCount} | FOODMENIA PARTNER NETWORK`, 105, 288, { align: "center" });
        }

        doc.save(`FoodMenia_Statement_${user.restaurantName.replace(/\s+/g, '_')}_${timeframe}.pdf`);
    };

    const pendingOrders = orders.filter((o) => o.status === "pending");
    const cancelRequestedOrders = orders.filter((o) => o.status === "cancel_requested");
    const activeOrders = orders.filter((o) => ["confirmed", "preparing", "out_for_delivery"].includes(o.status));
    const completedOrders = orders.filter((o) => ["delivered", "rejected", "cancelled"].includes(o.status));

    const getNextStatus = (currentStatus) => {
        const flow = { confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered" };
        return flow[currentStatus] || null;
    };

    const formatStatus = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return (
        <div className="dashboard-layout">
            {/* NAVBAR */}
            <nav className="dash-navbar">
                <div className="dash-brand">🍕 FoodMenia</div>
                <div className="dash-nav-right">
                    <div className="dash-user-info">
                        <div className="dash-user-avatar">
                            {user.fullName?.charAt(0)?.toUpperCase() || "O"}
                        </div>
                        <div>
                            <div className="dash-user-name">{user.fullName}</div>
                            <div className="dash-user-role">🏪 Operator • {user.restaurantName}</div>
                        </div>
                    </div>
                    <button className="btn-logout" onClick={handleLogout}>Logout</button>
                </div>
            </nav>

            {/* CONTENT */}
            <div className="dash-content">
                {/* TABS */}
                <div className="dash-tabs">
                    <button
                        className={`dash-tab ${activeTab === "menu" ? "active" : ""}`}
                        onClick={() => setActiveTab("menu")}
                    >
                        🍽️ Menu
                        <span className="tab-badge">{menuItems.length}</span>
                    </button>
                    <button
                        className={`dash-tab ${activeTab === "orders" ? "active" : ""}`}
                        onClick={() => setActiveTab("orders")}
                    >
                        📦 Orders
                        {pendingOrders.length > 0 && <span className="tab-badge">{pendingOrders.length}</span>}
                    </button>
                    <button
                        className={`dash-tab ${activeTab === "profit" ? "active" : ""}`}
                        onClick={() => setActiveTab("profit")}
                    >
                        💰 Profit
                    </button>
                </div>

                {/* MENU TAB */}
                {activeTab === "menu" && (
                    <div>
                        <div className="section-header">
                            <h2 className="section-title">Your Menu</h2>
                            <button className="btn-primary" onClick={() => {
                                if (showAddForm && editingItem) {
                                    handleCancelEdit();
                                } else {
                                    setShowAddForm(!showAddForm);
                                }
                            }}>
                                {showAddForm ? "✕ Cancel" : "＋ Add Item"}
                            </button>
                        </div>

                        {/* ADD/EDIT FORM */}
                        {showAddForm && (
                            <form className="add-menu-form" onSubmit={handleSubmitItem}>
                                <div className="form-title">{editingItem ? `✏️ Edit Item: ${editingItem.name}` : "🆕 Add New Menu Item"}</div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Butter Chicken"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Price (₹) *</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 299"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            required
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option>General</option>
                                            <option>Starter</option>
                                            <option>Main Course</option>
                                            <option>Dessert</option>
                                            <option>Beverage</option>
                                            <option>Snacks</option>
                                            <option>Biryani</option>
                                            <option>Pizza</option>
                                            <option>Burger</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Image</label>
                                        <div className="image-upload-area">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="preview" className="image-preview" />
                                            ) : (
                                                <div className="upload-placeholder">
                                                    <span className="upload-icon">📸</span>
                                                    <span className="upload-text">Click to upload image</span>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                style={{ zIndex: 10, cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Description</label>
                                        <textarea
                                            placeholder="A short description of the dish..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? (editingItem ? "Updating..." : "Adding...") : (editingItem ? "Update Item" : "Add Menu Item")}
                                </button>
                                {editingItem && (
                                    <button type="button" className="btn-secondary" style={{ marginLeft: "10px" }} onClick={handleCancelEdit}>
                                        Cancel Edit
                                    </button>
                                )}
                            </form>
                        )}

                        {/* MENU GRID */}
                        {menuItems.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🍽️</div>
                                <div className="empty-title">No Menu Items Yet</div>
                                <div className="empty-desc">
                                    Start adding items to your menu so users can order from your restaurant.
                                </div>
                            </div>
                        ) : (
                            <div className="menu-grid">
                                {menuItems.map((item) => (
                                    <div className="menu-card" key={item._id}>
                                        {item.image ? (
                                            <img
                                                src={`${CONFIG.UPLOADS_BASE}${item.image}`}
                                                alt={item.name}
                                                className="menu-card-image"
                                            />
                                        ) : (
                                            <div className="menu-card-placeholder">🍔</div>
                                        )}
                                        <div className="menu-card-body">
                                            <div className="menu-card-name">{item.name}</div>
                                            <div
                                                className="avg-rating"
                                                onClick={() => setReviewPanel({ show: true, item: item })}
                                                style={{ cursor: "pointer" }}
                                                title="Manage Reviews"
                                            >
                                                <span className="star">★</span> {item.averageRating || "0.0"}
                                                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>({item.ratings?.length || 0})</span>
                                            </div>
                                            <div className="menu-card-desc">{item.description || "No description"}</div>
                                            <div className="menu-card-footer">
                                                <div className="menu-card-price">₹{item.price}</div>
                                                <div className="menu-card-category">{item.category}</div>
                                            </div>
                                            <div className="menu-card-actions">

                                                <button
                                                    className="btn-icon"
                                                    style={{ color: "#60a5fa", borderColor: "rgba(59, 130, 246, 0.3)" }}
                                                    onClick={() => handleEditClick(item)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="btn-icon danger"
                                                    onClick={() => handleDeleteItem(item._id)}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ORDERS TAB */}
                {activeTab === "orders" && (
                    <div>
                        {/* Pending Orders */}
                        {pendingOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16 }}>
                                    ⏳ Pending Orders ({pendingOrders.length})
                                </h2>
                                <div className="orders-list" style={{ marginBottom: 32 }}>
                                    {pendingOrders.map((order) => (
                                        <div className="order-card" key={order._id}>
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-customer">{order.userName}</div>
                                                    <div className="order-customer-email">{order.userEmail}</div>
                                                    <div className="order-time">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className="order-status status-pending">Pending</span>
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
                                                <div className="order-actions">
                                                    <button
                                                        className="btn-confirm"
                                                        onClick={() => handleUpdateStatus(order._id, "confirmed")}
                                                    >
                                                        ✅ Accept
                                                    </button>
                                                    <button
                                                        className="btn-reject"
                                                        onClick={() => setRejectionModal({ show: true, orderId: order._id })}
                                                    >
                                                        ❌ Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Cancellation Requests */}
                        {cancelRequestedOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16, color: "#fca5a5" }}>
                                    🚫 Cancellation Requests ({cancelRequestedOrders.length})
                                </h2>
                                <div className="orders-list" style={{ marginBottom: 32 }}>
                                    {cancelRequestedOrders.map((order) => (
                                        <div className="order-card" key={order._id} style={{ border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.05)" }}>
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-customer">{order.userName}</div>
                                                    <div className="order-time">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className="order-status status-rejected">Requested</span>
                                            </div>
                                            <div className="rejection-reason" style={{ margin: "0 16px 16px", color: "#fca5a5", fontSize: "0.9rem" }}>
                                                User Reason: {order.cancellationReason || "No reason provided"}
                                            </div>
                                            <div className="order-footer">
                                                <div className="order-total">
                                                    <span>Total</span>₹{order.totalAmount}
                                                </div>
                                                <div className="order-actions">
                                                    <button
                                                        className="btn-reject"
                                                        style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
                                                        onClick={() => handleUpdateStatus(order._id, "cancelled")}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        className="btn-confirm"
                                                        onClick={() => handleUpdateStatus(order._id, "confirmed")}
                                                    >
                                                        Deny & Confirm
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Active Orders */}
                        {activeOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16 }}>
                                    🔥 Active Orders ({activeOrders.length})
                                </h2>
                                <div className="orders-list" style={{ marginBottom: 32 }}>
                                    {activeOrders.map((order) => (
                                        <div className="order-card" key={order._id}>
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-customer">{order.userName}</div>
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
                                                    <div className="order-item" key={i}>
                                                        <div className="order-item-left">
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
                                                {getNextStatus(order.status) && (
                                                    <button
                                                        className="btn-status"
                                                        onClick={() => handleUpdateStatus(order._id, getNextStatus(order.status))}
                                                    >
                                                        ➡️ Mark as {formatStatus(getNextStatus(order.status))}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Completed Orders */}
                        {completedOrders.length > 0 && (
                            <>
                                <h2 className="section-title" style={{ marginBottom: 16 }}>
                                    ✅ Completed / Rejected ({completedOrders.length})
                                </h2>
                                <div className="orders-list">
                                    {completedOrders.slice(0, 20).map((order) => (
                                        <div className="order-card" key={order._id} style={{ opacity: 0.7 }}>
                                            <div className="order-header">
                                                <div>
                                                    <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                    <div className="order-customer">{order.userName}</div>
                                                    <div className="order-time">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className={`order-status status-${order.status}`}>
                                                    {formatStatus(order.status)}
                                                </span>
                                            </div>
                                            <div className="order-footer">
                                                <div className="order-total">
                                                    <span>Total</span>₹{order.totalAmount}
                                                </div>
                                            </div>
                                            {order.status === "rejected" && order.rejectionReason && (
                                                <div className="rejection-reason">
                                                    Reason: {order.rejectionReason}
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
                                <div className="empty-desc">
                                    When users order from your restaurant, orders will appear here.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PROFIT TAB */}
                {activeTab === "profit" && (
                    <div className="profit-tab-container">
                        <div className="section-header">
                            <h2 className="section-title">Financial Analytics</h2>
                            <div className="timeframe-selector">
                                {["day", "month", "2_months", "6_months", "year", "custom"].map((tf) => (
                                    <button
                                        key={tf}
                                        className={`tf-btn ${profitTimeframe === tf ? "active" : ""}`}
                                        onClick={() => setProfitTimeframe(tf)}
                                    >
                                        {tf.replace("_", " ")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {profitTimeframe === "custom" && (
                            <div className="custom-date-row">
                                <div className="date-field">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={customDates.start}
                                        onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                    />
                                </div>
                                <div className="date-field">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={customDates.end}
                                        onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        {(() => {
                            const now = new Date();
                            const filterDate = new Date();
                            if (profitTimeframe === "day") filterDate.setHours(0, 0, 0, 0);
                            else if (profitTimeframe === "month") filterDate.setDate(now.getDate() - 30);
                            else if (profitTimeframe === "2_months") filterDate.setDate(now.getDate() - 60);
                            else if (profitTimeframe === "6_months") filterDate.setDate(now.getDate() - 180);
                            else if (profitTimeframe === "year") filterDate.setDate(now.getDate() - 365);

                            const filteredDelivered = orders.filter(o => {
                                if (o.status !== "delivered") return false;
                                const oDate = new Date(o.createdAt);
                                if (profitTimeframe === "custom") {
                                    const s = customDates.start ? new Date(customDates.start) : null;
                                    const e = customDates.end ? new Date(customDates.end) : null;
                                    if (s) s.setHours(0, 0, 0, 0);
                                    if (e) e.setHours(23, 59, 59, 999);
                                    if (s && oDate < s) return false;
                                    if (e && oDate > e) return false;
                                    return true;
                                }
                                return oDate >= filterDate;
                            });

                            const grossRevenue = filteredDelivered.reduce((sum, o) => sum + o.totalAmount, 0);
                            const platformFee = grossRevenue * 0.05;
                            const netProfit = grossRevenue - platformFee;

                            return (
                                <>
                                    <div className="profit-actions" style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn-download-pdf"
                                            onClick={() => handleDownloadInvoice(filteredDelivered, {
                                                grossRevenue, platformFee, netProfit, timeframe: profitTimeframe
                                            })}
                                            disabled={filteredDelivered.length === 0}
                                        >
                                            📄 Download Invoice PDF
                                        </button>
                                    </div>
                                    <div className="profit-summary-grid">
                                        <div className="profit-card total">
                                            <div className="profit-card-label">Gross Revenue</div>
                                            <div className="profit-card-val">₹{grossRevenue.toLocaleString()}</div>
                                            <div className="profit-card-sub">{filteredDelivered.length} Orders</div>
                                        </div>
                                        <div className="profit-card fees">
                                            <div className="profit-card-label">Platform Fees (5%)</div>
                                            <div className="profit-card-val">₹{platformFee.toLocaleString()}</div>
                                            <div className="profit-card-sub">Deducted automatically</div>
                                        </div>
                                        <div className="profit-card net">
                                            <div className="profit-card-label">Net Profit</div>
                                            <div className="profit-card-val">₹{netProfit.toLocaleString()}</div>
                                            <div className="profit-card-sub">Your actual earnings</div>
                                        </div>
                                    </div>

                                    <h3 className="section-title" style={{ marginTop: 40, marginBottom: 20 }}>Order History ({profitTimeframe.replace("_", " ")})</h3>
                                    {filteredDelivered.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon">💸</div>
                                            <div className="empty-title">No Revenue Data</div>
                                            <div className="empty-desc">There are no delivered orders for the selected period.</div>
                                        </div>
                                    ) : (
                                        <div className="orders-list">
                                            {filteredDelivered.map((order) => (
                                                <div className="order-card" key={order._id}>
                                                    <div className="order-header">
                                                        <div>
                                                            <div className="order-id">#{order._id.slice(-8).toUpperCase()}</div>
                                                            <div className="order-customer">{order.userName}</div>
                                                            <div className="order-time">{new Date(order.createdAt).toLocaleString()}</div>
                                                        </div>
                                                        <div style={{ textAlign: "right" }}>
                                                            <div className="order-total" style={{ margin: 0 }}>₹{order.totalAmount}</div>
                                                            <div style={{ fontSize: "0.8rem", color: "rgba(255,121,198,0.6)" }}>Fee: ₹{(order.totalAmount * 0.05).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* REJECTION MODAL */}
            {rejectionModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-title">❌ Reject Order</div>
                        <div className="modal-body">
                            <p>Are you sure you want to reject this order? You can provide a reason below:</p>
                            <textarea
                                className="textarea-input"
                                placeholder="e.g. Out of stock, closing soon..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-icon" onClick={() => { setRejectionModal({ show: false, orderId: null }); setRejectionReason(""); }}>Cancel</button>
                            <button className="btn-primary" onClick={() => {
                                handleUpdateStatus(rejectionModal.orderId, "rejected", rejectionReason);
                                setRejectionModal({ show: false, orderId: null });
                                setRejectionReason("");
                            }}>Confirm Rejection</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST */}
            {/* REVIEW MANAGEMENT PANEL */}
            {reviewPanel.show && (
                <div className="modal-overlay" onClick={() => setReviewPanel({ show: false, item: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <div className="modal-title" style={{ margin: 0 }}>💬 Reviews for {reviewPanel.item.name}</div>
                            <button className="close-btn" onClick={() => setReviewPanel({ show: false, item: null })} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
                            <div className="reviews-list" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                {reviewPanel.item.ratings?.length > 0 ? (
                                    reviewPanel.item.ratings.map((r, i) => (
                                        <div key={i} className="review-item" style={{ padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                <div style={{ fontWeight: 700, color: "#60a5fa" }}>{r.userName}</div>
                                                <div style={{ color: "#ff512f" }}>{"★".repeat(r.rating)}</div>
                                            </div>
                                            <div style={{ fontSize: "0.9rem", color: "#ddd", marginBottom: "12px" }}>{r.comment || "No comment."}</div>

                                            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                                                <button
                                                    onClick={() => handleLikeRating(reviewPanel.item._id, r._id)}
                                                    style={{ background: "none", border: "none", color: r.likes?.includes(user.id) ? "#ff512f" : "#fff", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                                                >
                                                    {r.likes?.includes(user.id) ? "❤️" : "🤍"} {r.likes?.length || 0}
                                                </button>
                                                <div style={{ fontSize: "0.7rem", opacity: 0.4 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                                            </div>

                                            {/* Replies List */}
                                            {r.replies?.length > 0 && (
                                                <div style={{ marginLeft: "15px", paddingLeft: "15px", borderLeft: "2px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                                                    {r.replies.map((reply, ri) => (
                                                        <div key={ri} style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px" }}>
                                                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9ae6b4" }}>{reply.userName}</div>
                                                            <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>{reply.text}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reply Input */}
                                            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                                                <input
                                                    type="text"
                                                    placeholder="Reply to customer..."
                                                    style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.8rem" }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            handleReplyRating(reviewPanel.item._id, r._id, e.target.value);
                                                            e.target.value = "";
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: "center", padding: "40px", opacity: 0.4 }}>No reviews yet.</div>
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
