require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🔑 إعدادات Google OAuth
// ==========================================
const GOOGLE_CLIENT_ID = "1350348082-tcanubevctn0kamh9uj63dmjbc9aj3r0.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "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";

// 📧 قائمة إيميلات الأدمن (اكتب إيميلك الخاص هنا لحماية صفحة الأدمن)
const ADMIN_EMAILS = [
    "mohamadyamakasi31@gmail.com" // 👈 استبدل هذا بإيميلك الحقيقي في Google
];

app.use(express.json());

app.use(session({
    secret: 'fastfood_aadl_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    const userEmail = profile.emails[0].value;
    const user = {
        id: profile.id,
        name: profile.displayName,
        email: userEmail,
        photo: profile.photos[0].value,
        isAdmin: ADMIN_EMAILS.includes(userEmail)
    };
    return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const server = http.createServer(app);
const io = new Server(server);

// الاتصال بقاعدة البيانات
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fastfood_aadl";
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات!'))
    .catch((err) => console.log('⚠️ يعمل السيرفر بدون قاعدة بيانات:', err.message));

// مخطط الطلبات
const orderSchema = new mongoose.Schema({
    customerName: String,
    customerEmail: String,
    customerPhoto: String,
    phone: String,
    foodItem: String,
    siteAADL: String,
    buildingNo: String,
    status: { type: String, default: 'قيد الانتظار' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// 🚀 المسارات (Routes)
// ==========================================
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.get('/api/current_user', (req, res) => {
    res.json(req.user || null);
});

// حفظ الطلب
app.post('/api/orders/create', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const newOrder = new Order(req.body);
            await newOrder.save();
            io.emit('new_order_added', newOrder);
        } else {
            io.emit('new_order_added', req.body);
        }
        res.status(201).json({ message: "تم إرسال طلبك بنجاح! سيتصل بك الموصل فور تجهيز الوجبة 🛵" });
    } catch (error) {
        res.status(500).json({ message: "حدث خطأ أثناء تسجيل الطلب" });
    }
});

// 1. الواجهة الرئيسية للزبون
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FastFood AADL</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #e63946; --primary-dark: #c1121f; --bg: #f8f9fa; --dark: #1d3557; --card-bg: #ffffff; }
        * { box-sizing: border-box; font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; }
        body { background-color: var(--bg); color: #333; padding-bottom: 60px; }
        header { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 15px 5%; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(230, 57, 70, 0.3); position: sticky; top: 0; z-index: 100; }
        .logo-title { font-size: 1.5rem; font-weight: 800; }
        .user-nav { display: flex; align-items: center; gap: 12px; }
        .btn-google-head { background: white; color: var(--dark); text-decoration: none; padding: 8px 16px; border-radius: 50px; font-weight: 700; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .user-avatar { width: 38px; height: 38px; border-radius: 50%; border: 2px solid white; }
        .btn-logout { color: white; text-decoration: underline; font-size: 0.85rem; margin-right: 8px; }
        .hero { background: linear-gradient(rgba(29, 53, 87, 0.85), rgba(29, 53, 87, 0.85)), url('https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=1000&auto=format&fit=crop'); background-size: cover; background-position: center; color: white; text-align: center; padding: 50px 20px; margin-bottom: 30px; }
        .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
        .section-title { font-size: 1.6rem; font-weight: 700; margin-bottom: 20px; color: var(--dark); border-right: 4px solid var(--primary); padding-right: 10px; }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
        .food-card { background: var(--card-bg); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.06); }
        .food-img { width: 100%; height: 180px; object-fit: cover; }
        .food-info { padding: 20px; }
        .food-title { font-size: 1.3rem; font-weight: 700; color: var(--dark); margin-bottom: 8px; }
        .card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
        .price-tag { font-size: 1.3rem; font-weight: 800; color: var(--primary); }
        .btn-order-now { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .modal-overlay { position: fixed; top: 0; right: 0; left: 0; bottom: 0; background: rgba(0,0,0,0.6); display: none; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; width: 90%; max-width: 450px; border-radius: 20px; padding: 30px; position: relative; }
        .close-btn { position: absolute; left: 20px; top: 20px; font-size: 1.5rem; cursor: pointer; }
        .input-group { margin-bottom: 15px; text-align: right; }
        .input-group label { display: block; font-weight: 700; margin-bottom: 5px; }
        .input-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
        .btn-submit-order { background: #25d366; color: white; border: none; padding: 14px; border-radius: 10px; font-size: 1.1rem; font-weight: 800; width: 100%; cursor: pointer; }
    </style>
</head>
<body>
    <header>
        <div class="logo-title">🍗 FastFood AADL</div>
        <div class="user-nav">
            <div id="logged-out-view">
                <a href="/auth/google" class="btn-google-head">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> دخول بحساب Google
                </a>
            </div>
            <div id="logged-in-view" style="display: none; align-items: center; gap: 10px;">
                <img id="head-user-avatar" class="user-avatar" src="" alt="user">
                <span id="head-user-name" style="font-weight: 700;"></span>
                <a href="/admin" id="admin-link" style="display:none; color:#f1c40f; font-weight:bold; margin-right:8px; text-decoration:none;">لوحة الأدمن ⚙️</a>
                <a href="/auth/logout" class="btn-logout">خروج</a>
            </div>
        </div>
    </header>

    <div class="hero">
        <h1>أباطرة الكريسبي والبرغر.. عند باب العمارة! 🛵</h1>
        <p>توصيل مقرمش وسريع لجميع أحياء وقرى سكنات عدل AADL</p>
    </div>

    <div class="container">
        <h2 class="section-title">قائمة الوجبات المقرمشة 🍗</h2>
        <div class="menu-grid">
            <div class="food-card">
                <img src="https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=600&auto=format&fit=crop" class="food-img">
                <div class="food-info">
                    <div class="food-title">دجاج كريسبي مقرمش (كبير) 🍗🔥</div>
                    <div class="card-bottom">
                        <span class="price-tag">750 د.ج</span>
                        <button class="btn-order-now" onclick="openOrderModal('دجاج كريسبي مقرمش (كبير) 🍗🔥', '750 د.ج')">اطلب الآن</button>
                    </div>
                </div>
            </div>
            <div class="food-card">
                <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop" class="food-img">
                <div class="food-info">
                    <div class="food-title">برغر عدل الملكي 🍔</div>
                    <div class="card-bottom">
                        <span class="price-tag">600 د.ج</span>
                        <button class="btn-order-now" onclick="openOrderModal('برغر عدل الملكي 🍔', '600 د.ج')">اطلب الآن</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="orderModal" class="modal-overlay">
        <div class="modal-content">
            <span class="close-btn" onclick="closeOrderModal()">&times;</span>
            <h3 id="modalFoodTitle" style="color: var(--primary); margin-bottom: 5px;">تأكيد الطلب</h3>
            <p id="modalFoodPrice" style="font-weight: bold; margin-bottom: 20px; color: #666;"></p>
            <div id="guest-name-box" class="input-group" style="display: none;">
                <label>الاسم واللقب:</label>
                <input type="text" id="custName" placeholder="أدخل اسمك الكريم">
            </div>
            <div class="input-group">
                <label>اسم الموقع (حي عدل):</label>
                <input type="text" id="siteAADL" placeholder="مثال: عدل 2000 مسكن">
            </div>
            <div class="input-group">
                <label>رقم العمارة والشقة:</label>
                <input type="text" id="buildingNo" placeholder="مثال: عمارة 04B، شقة 12">
            </div>
            <div class="input-group">
                <label>رقم الهاتف:</label>
                <input type="text" id="phone" placeholder="06XXXXXXXX">
            </div>
            <button class="btn-submit-order" onclick="submitOrder()">تأكيد الطلب (الدفع كاش) 💵</button>
        </div>
    </div>

    <script>
        let currentUser = null;
        let selectedFood = "";

        fetch('/api/current_user')
            .then(res => res.json())
            .then(user => {
                if (user) {
                    currentUser = user;
                    document.getElementById('logged-out-view').style.display = 'none';
                    document.getElementById('logged-in-view').style.display = 'flex';
                    document.getElementById('head-user-avatar').src = currentUser.photo;
                    document.getElementById('head-user-name').innerText = currentUser.name.split(' ')[0];
                    if (currentUser.isAdmin) {
                        document.getElementById('admin-link').style.display = 'inline-block';
                    }
                }
            });

        function openOrderModal(foodName, price) {
            selectedFood = foodName;
            document.getElementById('modalFoodTitle').innerText = 'طلب: ' + foodName;
            document.getElementById('modalFoodPrice').innerText = 'السعر الإجمالي: ' + price;
            document.getElementById('guest-name-box').style.display = currentUser ? 'none' : 'block';
            document.getElementById('orderModal').style.display = 'flex';
        }

        function closeOrderModal() {
            document.getElementById('orderModal').style.display = 'none';
        }

        async function submitOrder() {
            const site = document.getElementById('siteAADL').value;
            const building = document.getElementById('buildingNo').value;
            const phone = document.getElementById('phone').value;
            let name = currentUser ? currentUser.name : document.getElementById('custName').value;
            let email = currentUser ? currentUser.email : "زبون بدون إيميل";
            let photo = currentUser ? currentUser.photo : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

            if (!name || !site || !phone) {
                alert('يرجى كتابة الاسم والموقع ورقم الهاتف!');
                return;
            }

            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: name,
                    customerEmail: email,
                    customerPhoto: photo,
                    phone: phone,
                    foodItem: selectedFood,
                    siteAADL: site,
                    buildingNo: building
                })
            });
            const data = await res.json();
            alert(data.message);
            closeOrderModal();
        }
    </script>
</body>
</html>`);
});

// 2. واجهة الأدمن والعمال
app.get('/admin', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لوحة تحكم الطلبات - FastFood AADL</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { font-family: 'Tajawal', sans-serif; background: #1a1a2e; color: white; padding: 20px; margin: 0; }
        h1 { text-align: center; color: #e63946; margin-bottom: 30px; }
        .orders-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .order-card { background: #16213e; border-radius: 12px; padding: 20px; border-right: 5px solid #e63946; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .user-info { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #0f3460; padding-bottom: 10px; }
        .user-avatar { width: 45px; height: 45px; border-radius: 50%; }
        .item-name { font-size: 1.2rem; font-weight: bold; color: #f1c40f; margin-bottom: 10px; }
        .details p { margin: 5px 0; color: #cbd5e1; }
        .phone-btn { display: inline-block; margin-top: 15px; background: #25d366; color: white; text-decoration: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; text-align: center; width: 100%; box-sizing: border-box; }
    </style>
</head>
<body>
    <h1>🛵 لوحة استقبال الطلبات الحية (AADL)</h1>
    <div id="ordersContainer" class="orders-grid"></div>

    <script>
        const socket = io();
        const alertAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        function addOrderToScreen(order) {
            const container = document.getElementById('ordersContainer');
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = \`
                <div class="user-info">
                    <img src="\${order.customerPhoto || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="user-avatar">
                    <div>
                        <strong>\${order.customerName}</strong><br>
                        <small style="color: #94a3b8;">\${order.customerEmail || ''}</small>
                    </div>
                </div>
                <div class="item-name">🍔 \${order.foodItem}</div>
                <div class="details">
                    <p>📍 <strong>الحي:</strong> \${order.siteAADL}</p>
                    <p>🏢 <strong>العمارة/الشقة:</strong> \${order.buildingNo}</p>
                    <p>📞 <strong>الهاتف:</strong> \${order.phone}</p>
                </div>
                <a href="tel:\${order.phone}" class="phone-btn">الاتصال بالزبون 📞</a>
            \`;
            container.prepend(card);
        }

        socket.on('new_order_added', (newOrder) => {
            alertAudio.play().catch(() => console.log('صوت التنبيه محجوب بانتظار التفاعل'));
            addOrderToScreen(newOrder);
        });
    </script>
</body>
</html>`);
});

server.listen(PORT, () => console.log(`🚀 السيرفر يعمل على: http://localhost:${PORT}`));