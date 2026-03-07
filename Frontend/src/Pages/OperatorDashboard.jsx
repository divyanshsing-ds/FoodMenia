import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/dashboard.css";
import OperatorCreatorChat from "../components/OperatorCreatorChat";

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
        foodType: "veg",
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [rejectionModal, setRejectionModal] = useState({ show: false, orderId: null });
    const [rejectionReason, setRejectionReason] = useState("");
    const [editingItem, setEditingItem] = useState(null);
    const [profitTimeframe, setProfitTimeframe] = useState("month");
    const [customDates, setCustomDates] = useState({ start: "", end: "" });
    const [reviewPanel, setReviewPanel] = useState({ show: false, item: null });
    const [otpInput, setOtpInput] = useState({}); // keyed by orderId
    const knownOrderIds = useRef(new Set());

    const user = JSON.parse(localStorage.getItem(CONFIG.dataKey("operator")) || "{}");
    const token = localStorage.getItem(CONFIG.tokenKey("operator"));

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    };

    const authHeaders = useCallback(() => ({
        Authorization: `Bearer ${token}`,
    }), [token]);

    // Fetch menu items
    const fetchMenu = useCallback(async (isSilent = false) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/menu/my?t=${Date.now()}`, { headers: authHeaders() });
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
            if (!isSilent) showToast("error", "Failed to load menu items");
        }
    }, [authHeaders, reviewPanel?.show, reviewPanel?.item]);

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
        const interval = setInterval(() => {
            fetchOrders(true);
            fetchMenu(true);
        }, 5000);
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
            fd.append("foodType", formData.foodType);
            if (imageFile) {
                fd.append("image", imageFile);
            }
            const url = editingItem ? `${CONFIG.API_BASE}/menu/${editingItem._id}` : `${CONFIG.API_BASE}/menu`;
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
                console.warn("API Error:", data.message, data.error);
                showToast("error", data.error || data.message || "Operation failed");
            }
        } catch (err) {
            console.error("Submission Error:", err);
            showToast("error", `Failed to ${editingItem ? "update" : "add"} menu item. Check console.`);
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
            category: item.category || "General",
            foodType: item.foodType || "veg"
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
    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/${orderId}/status`, {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", `Order marked as ${newStatus.replace(/_/g, " ")}`);
                fetchOrders(true);
            } else {
                showToast("error", data.message || "Failed to update status");
            }
        } catch {
            showToast("error", "Failed to update status");
        }
    };

    // Verify OTP and mark order as delivered
    const handleVerifyOtp = async (orderId) => {
        const otp = otpInput[orderId] || "";
        if (!otp || otp.length !== 4) {
            showToast("error", "Please enter the 4-digit OTP.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_BASE}/orders/${orderId}/verify-otp`, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ otp }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", "✅ Delivery confirmed! Payment collected.");
                setOtpInput(prev => { const n = { ...prev }; delete n[orderId]; return n; });
                fetchOrders(true);
            } else {
                showToast("error", data.message || "Invalid OTP");
            }
        } catch {
            showToast("error", "OTP verification failed");
        } finally {
            setLoading(false);
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
            } else {
                showToast("error", data.message || "Failed to send reply");
            }
        } catch (err) {
            console.error("Reply Error:", err);
            showToast("error", "Failed to send reply");
        }
    };

    // Image handler
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem(CONFIG.tokenKey("operator"));
        localStorage.removeItem(CONFIG.dataKey("operator"));
        navigate("/");
    };

    const handleDownloadInvoice = (filteredOrders, stats) => {
        const doc = new jsPDF();
        const { grossRevenue, platformFee, netProfit, totalStudentDiscounts, timeframe } = stats;

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

        // Student Discount Card (New)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(15, 115, 42, 35, 2, 2, 'DF');
        doc.setFillColor(34, 197, 94); // Green dot
        doc.circle(20, 122, 1.2, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7);
        doc.text("GROSS REV", 24, 123);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(11);
        doc.text(`Rs. ${grossRevenue.toLocaleString()}`, 20, 138);

        // Student Offer Card
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(61, 115, 42, 35, 2, 2, 'DF');
        doc.setFillColor(255, 81, 47); // Orange dot
        doc.circle(66, 122, 1.2, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7);
        doc.text("STUDENT OFF", 70, 123);
        doc.setTextColor(255, 81, 47);
        doc.setFontSize(11);
        doc.text(`Rs. ${totalStudentDiscounts.toLocaleString()}`, 66, 138);

        // Fee Card
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(107, 115, 42, 35, 2, 2, 'DF');
        doc.setFillColor(189, 147, 249); // Purple dot
        doc.circle(112, 122, 1.2, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7);
        doc.text("FEE (5%)", 116, 123);
        doc.setTextColor(189, 147, 249);
        doc.setFontSize(11);
        doc.text(`Rs. ${platformFee.toLocaleString()}`, 112, 138);

        // Net Card
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(34, 197, 94);
        doc.roundedRect(153, 115, 42, 35, 2, 2, 'DF');
        doc.setFillColor(34, 197, 94);
        doc.circle(158, 122, 1.2, 'F');
        doc.setTextColor(21, 128, 61);
        doc.setFontSize(7);
        doc.text("NET PAYOUT", 162, 123);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Rs. ${netProfit.toLocaleString()}`, 158, 138);

        // --- 4. ORDER BREAKDOWN TABLE ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("DETAILED ORDER BREAKDOWN", 15, 165);

        const tableData = filteredOrders.map(o => [
            `#${o._id.slice(-8).toUpperCase()}${o.studentDiscountApplied ? " (STUDENT)" : ""}`,
            o.items.map(item => {
                const bestSellerMark = menuItems.find(m => m._id === item.menuItemId?.toString() || m.name === item.name)?.isBestSeller;
                return `${bestSellerMark ? "[BESTSELLER] " : ""}${item.name} (x${item.quantity})`;
            }).join(", "),
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
            margin: { left: 15, right: 15, top: 20, bottom: 40 }
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
                <div className="dash-brand">🍕 <span>FoodMenia</span></div>
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
                    <button
                        className={`dash-tab ${activeTab === "collab" ? "active" : ""}`}
                        onClick={() => setActiveTab("collab")}
                    >
                        🤝 Collab
                    </button>
                </div>

                {/* MENU TAB */}
                {activeTab === "menu" && (
                    <div>
                        <div className="section-header">
                            <h2 className="section-title">Your Menu</h2>
                            <div className="flex align-center gap-4">
                                <button
                                    className="btn-secondary"
                                    title="Recalculate Best Sellers (weekly)"
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`${CONFIG.API_BASE}/menu/recalculate-best-sellers`, {
                                                method: "POST",
                                                headers: { Authorization: `Bearer ${token}` },
                                            });
                                            const data = await res.json();
                                            showToast(data.success ? "success" : "info", data.message);
                                            if (data.success) fetchMenu();
                                        } catch {
                                            showToast("error", "Failed to recalculate.");
                                        }
                                    }}
                                >
                                    🏆 Refresh Best Sellers
                                </button>
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
                                        <label>Food Type</label>
                                        <select
                                            value={formData.foodType}
                                            onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
                                        >
                                            <option value="veg">🟢 Veg</option>
                                            <option value="non-veg">🔴 Non-Veg</option>
                                            <option value="both">🟡 Both</option>
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
                                                className="upload-input-overlay"
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
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? (editingItem ? "Updating..." : "Adding...") : (editingItem ? "Update Item" : "Add Menu Item")}
                                    </button>
                                    {editingItem && (
                                        <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
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
                                        {item.isBestSeller && (
                                            <div className="best-seller-badge">🔥 Best Seller</div>
                                        )}
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
                                                className="avg-rating cursor-pointer"
                                                onClick={() => setReviewPanel({ show: true, item: item })}
                                                title="Manage Reviews"
                                            >
                                                <span className="star">★</span> {item.averageRating || "0.0"}
                                                <span className="text-xs text-muted ml-8">({item.ratings?.length || 0})</span>
                                            </div>
                                            <div className="menu-card-desc">{item.description || "No description"}</div>
                                            <div className="menu-card-footer">
                                                <div className="menu-card-price">₹{item.price}</div>
                                                <div className="menu-card-category">{item.category}</div>
                                                <div className="menu-card-ordered">
                                                    📦 {item.orderCount || 0} ordered
                                                </div>
                                            </div>
                                            <div className="menu-card-actions">

                                                <button
                                                    className="btn-icon info"
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
                                <h2 className="section-title mb-16">
                                    ⏳ Pending Orders ({pendingOrders.length})
                                </h2>
                                <div className="orders-list mb-32">
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
                                                <div className="order-actions gap-12">
                                                    <button
                                                        className="btn-primary btn-success flex-grow"
                                                        onClick={() => handleUpdateStatus(order._id, "confirmed")}
                                                    >
                                                        ✅ Accept Order
                                                    </button>
                                                    <button
                                                        className="btn-secondary btn-danger"
                                                        onClick={() => setRejectionModal({ show: true, orderId: order._id })}
                                                    >
                                                        ✕ Reject
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
                                <h2 className="section-title mb-16 text-danger-light">
                                    🚫 Cancellation Requests ({cancelRequestedOrders.length})
                                </h2>
                                <div className="orders-list mb-32">
                                    {cancelRequestedOrders.map((order) => (
                                        <div className="order-card order-card-cancel-req" key={order._id}>
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
                                            <div className="rejection-reason rejection-reason-box">
                                                <div className="text-sm font-700 mb-4">📞 {order.customerPhone}</div>
                                                User Reason: {order.cancellationReason || "No reason provided"}
                                            </div>
                                            <div className="order-footer">
                                                <div className="order-total">
                                                    <span>Total</span>₹{order.totalAmount}
                                                </div>
                                                <div className="order-actions">
                                                    <button
                                                        className="btn-reject bg-danger text-white border-danger"
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
                                <h2 className="section-title mb-16">
                                    🔥 Active Orders ({activeOrders.length})
                                </h2>
                                <div className="orders-list mb-32">
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

                                            {/* Delivery Details & Instructions */}
                                            <div className="order-contact-details bg-dark-subtle p-12 mt-8 rounded">
                                                <div className="flex align-center gap-8 mb-4">
                                                    <span className="text-secondary opacity-70">📞</span>
                                                    <span className="font-700 text-sm"> {order.customerPhone || "N/A"}</span>
                                                </div>
                                                <div className="flex align-center gap-8 mb-8">
                                                    <span className="text-secondary opacity-70">🏠</span>
                                                    <span className="text-xs text-muted"> {order.customerAddress || "N/A"}</span>
                                                </div>
                                                {order.instructions && (
                                                    <div className="order-instruction-box">
                                                        <span className="instruction-label text-orange">Special Instructions:</span>
                                                        <p className="instruction-text text-xs italic text-muted mt-4">"{order.instructions}"</p>
                                                    </div>
                                                )}
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

                                                {/* Payment badge */}
                                                <span className={`payment-badge ${order.paymentStatus}`}>
                                                    {order.paymentMethod?.toUpperCase()} • {order.paymentStatus === "paid" ? "✅ Paid" : order.paymentStatus === "refunded" ? "🔄 Refunded" : "⏳ Unpaid"}
                                                </span>

                                                {/* OTP input for out_for_delivery */}
                                                {order.status === "out_for_delivery" ? (
                                                    <div className="flex align-center gap-8 flex-wrap mt-8">
                                                        <input
                                                            type="text"
                                                            maxLength={4}
                                                            placeholder="Enter OTP"
                                                            value={otpInput[order._id] || ""}
                                                            onChange={e => setOtpInput(prev => ({ ...prev, [order._id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                                            className="otp-input-field"
                                                        />
                                                        <button
                                                            className="btn-confirm"
                                                            onClick={() => handleVerifyOtp(order._id)}
                                                            disabled={loading}
                                                        >
                                                            📦 Verify & Deliver
                                                        </button>
                                                    </div>
                                                ) : getNextStatus(order.status) && (
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
                                <h2 className="section-title mb-16">
                                    ✅ Completed / Rejected ({completedOrders.length})
                                </h2>
                                <div className="orders-list">
                                    {completedOrders.slice(0, 20).map((order) => (
                                        <div className="order-card opacity-70" key={order._id}>
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
                            const totalStudentDiscounts = filteredDelivered.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
                            const platformFee = grossRevenue * 0.05;
                            const netProfit = grossRevenue - platformFee;

                            return (
                                <>
                                    <div className="profit-actions flex-end mb-24">
                                        <button
                                            className="btn-download-pdf"
                                            onClick={() => handleDownloadInvoice(filteredDelivered, {
                                                grossRevenue, platformFee, netProfit, totalStudentDiscounts, timeframe: profitTimeframe
                                            })}
                                            disabled={filteredDelivered.length === 0}
                                        >
                                            📄 Download Invoice PDF
                                        </button>
                                    </div>
                                    <div className="profit-summary-grid">
                                        <div className="profit-card">
                                            <div className="profit-label">Gross Revenue</div>
                                            <div className="profit-value">₹{grossRevenue.toLocaleString()}</div>
                                            <div className="text-xs text-muted mt-8">{filteredDelivered.length} Orders</div>
                                        </div>
                                        <div className="profit-card">
                                            <div className="profit-label">Student Discounts</div>
                                            <div className="profit-value text-orange">₹{totalStudentDiscounts.toLocaleString()}</div>
                                            <div className="text-xs text-muted mt-8">Impact on total revenue</div>
                                        </div>
                                        <div className="profit-card">
                                            <div className="profit-label">Platform Fees (5%)</div>
                                            <div className="profit-value text-danger-light">- ₹{platformFee.toLocaleString()}</div>
                                            <div className="text-xs text-muted mt-8">Based on discounted total</div>
                                        </div>
                                        <div className="profit-card">
                                            <div className="profit-label">Net Profit</div>
                                            <div className="profit-value text-green-light">₹{netProfit.toLocaleString()}</div>
                                            <div className="text-xs text-muted mt-8">Final partnership payout</div>
                                        </div>
                                    </div>

                                    <h3 className="section-title mt-40 mb-24">Order History ({profitTimeframe.replace("_", " ")})</h3>
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
                                                        <div className="text-right">
                                                            <div className="flex-col align-end gap-2">
                                                                <div className="order-total m-0">
                                                                    {order.studentDiscountApplied ? (
                                                                        <div className="flex align-center gap-8 justify-end">
                                                                            <s style={{ opacity: 0.4, fontSize: 12 }}>₹{order.totalAmount + (order.discountAmount || 0)}</s>
                                                                            <span>₹{order.totalAmount}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span>₹{order.totalAmount}</span>
                                                                    )}
                                                                </div>
                                                                {order.studentDiscountApplied && (
                                                                    <div className="order-student-badge" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                                                        🎓 STUDENT OFFER
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="fee-text mt-4">Fee: ₹{(order.totalAmount * 0.05).toFixed(2)}</div>
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
                {/* CREATOR COLLABORATION TAB */}
                {activeTab === "collab" && (
                    <OperatorCreatorChat
                        token={token}
                        user={user}
                        showToast={showToast}
                    />
                )}
            </div>

            {/* REJECTION MODAL */}
            {
                rejectionModal.show && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-title">🚫 Reject Order</div>
                            <div className="modal-body">
                                <p className="mb-12 text-secondary">Please provide a reason for rejecting this order:</p>
                                <textarea
                                    className="textarea-input"
                                    placeholder="Out of stock / Restaurant closed..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions gap-12">
                                <button className="btn-secondary" onClick={() => setRejectionModal({ show: false, orderId: null })}>Cancel</button>
                                <button
                                    className="btn-primary btn-danger flex-grow"
                                    onClick={async () => {
                                        if (!rejectionReason.trim()) {
                                            showToast("error", "Please enter a reason");
                                            return;
                                        }
                                        handleUpdateStatus(rejectionModal.orderId, "rejected");
                                        setRejectionModal({ show: false, orderId: null });
                                        setRejectionReason("");
                                    }}
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* REVIEW MANAGEMENT PANEL */}
            {reviewPanel.show && (
                <div className="modal-overlay" onClick={() => setReviewPanel({ show: false, item: null })}>
                    <div className="modal-content max-w-550" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header flex-between mb-24">
                            <div className="modal-title m-0">💬 Reviews for {reviewPanel.item.name}</div>
                            <button className="close-btn" onClick={() => setReviewPanel({ show: false, item: null })}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="reviews-list-container">
                                {reviewPanel.item.ratings?.length > 0 ? (
                                    reviewPanel.item.ratings.map((r, i) => (
                                        <div key={i} className="review-item-card mb-16">
                                            <div className="flex-between mb-8">
                                                <div className="review-user-name">{r.userName}</div>
                                                <div className="text-amber">{"★".repeat(r.rating)}</div>
                                            </div>
                                            <div className="review-text">{r.comment || "No comment."}</div>

                                            <div className="flex align-center gap-12 mb-12">
                                                <button
                                                    onClick={() => handleLikeRating(reviewPanel.item._id, r._id)}
                                                    className={`review-like-btn ${r.likes?.includes(user.id) ? "liked" : ""}`}
                                                >
                                                    {r.likes?.includes(user.id) ? "❤️" : "🤍"} {r.likes?.length || 0}
                                                </button>
                                                <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</div>
                                            </div>

                                            {/* Replies List */}
                                            {r.replies?.length > 0 && (
                                                <div className="ml-12 pl-12 border-left-glass flex-col gap-2 mt-12 mb-12">
                                                    {r.replies.map((reply, ri) => (
                                                        <div key={ri} className="glass-panel p-8">
                                                            <div className="text-xs font-bold text-success">{reply.userName}</div>
                                                            <div className="text-sm text-secondary">{reply.text}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reply Input */}
                                            <div className="review-reply-area mt-12">
                                                <input
                                                    type="text"
                                                    placeholder="Reply to customer..."
                                                    className="review-reply-input"
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && e.target.value.trim()) {
                                                            handleReplyRating(reviewPanel.item._id, r._id, e.target.value);
                                                            e.target.value = "";
                                                        }
                                                    }}
                                                />
                                                <button
                                                    className="review-post-btn"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.previousSibling;
                                                        if (input.value.trim()) {
                                                            handleReplyRating(reviewPanel.item._id, r._id, input.value);
                                                            input.value = "";
                                                        }
                                                    }}
                                                >
                                                    Post
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center p-24 text-muted">No reviews yet.</div>
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
