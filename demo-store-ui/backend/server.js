import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

if (!DATABASE_URL) console.warn('DATABASE_URL is missing. The API will not start until PostgreSQL is configured.');
if (!JWT_SECRET) console.warn('JWT_SECRET is missing. Authentication endpoints will be unavailable until configured.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));

const seedProducts = [
  [1,'چراغ رومیزی آوید','خانه و دکور',1850000,2200000,'assets/lamp.svg','چراغ رومیزی با طراحی مینیمال برای نور ملایم و فضای آرام.','بدنه فلزی و شید پارچه‌ای','۲۴ × ۳۸ سانتی‌متر','کرم و سبز زیتونی',12],
  [2,'هدفون بی‌سیم موج','دیجیتال',2450000,null,'assets/headphones.svg','هدفون بی‌سیم سبک برای گوش‌دادن روزمره به موسیقی و پادکست.','اتصال بلوتوث، میکروفون داخلی','تا ۲۰ ساعت پخش (مشخصات نمونه)','مشکی',18],
  [3,'کیف روزمره لینا','مد و پوشاک',1680000,1950000,'assets/bag.svg','کیف روزمره با فرم ساده و فضای مناسب وسایل ضروری.','پارچه مقاوم و آستر داخلی','۲۸ × ۲۲ سانتی‌متر','شتری',9],
  [4,'گلدان سرامیکی آرتا','خانه و دکور',790000,null,'assets/vase.svg','گلدان سرامیکی دکوراتیو برای چیدمان‌های ساده و مدرن.','سرامیک لعاب‌دار','ارتفاع ۲۲ سانتی‌متر','سفید',24],
  [5,'ساعت مینیمال تایم','اکسسوری',3250000,3600000,'assets/watch.svg','ساعت مینیمال با صفحه خوانا و بند ساده.','موتور کوارتز (نمونه)','قطر صفحه ۳۶ میلی‌متر','نقره‌ای',7],
  [6,'اسپیکر رومیزی نوا','دیجیتال',1980000,null,'assets/speaker.svg','اسپیکر جمع‌وجور برای پخش صدای روزمره در محیط خانه یا کار.','اتصال بلوتوث و ورودی USB-C','۱۶ × ۸ سانتی‌متر','سبز تیره',14],
  [7,'عینک آفتابی آوا','اکسسوری',1120000,1350000,'assets/glasses.svg','عینک آفتابی با فرم کلاسیک و طراحی سبک.','فریم سبک، لنز تیره','عرض فریم ۱۴ سانتی‌متر','قهوه‌ای',16],
  [8,'مانتو کتان مهتاب','مد و پوشاک',2890000,null,'assets/coat.svg','مانتو کتان با برش ساده برای استفاده روزمره.','پارچه کتان (نمونه)','سایزبندی پس از تأیید فروشگاه','کرم',11]
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      category VARCHAR(80) NOT NULL,
      price BIGINT NOT NULL CHECK (price > 0),
      old_price BIGINT,
      image TEXT NOT NULL DEFAULT 'assets/vase.svg',
      description TEXT NOT NULL DEFAULT '',
      specifications TEXT NOT NULL DEFAULT '',
      dimensions VARCHAR(120) NOT NULL DEFAULT '',
      color VARCHAR(120) NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      customer_name VARCHAR(100) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      address TEXT NOT NULL,
      postal_code VARCHAR(20) NOT NULL DEFAULT '',
      total BIGINT NOT NULL CHECK (total > 0),
      payment_method VARCHAR(30) NOT NULL DEFAULT 'cash_on_delivery',
      payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
      status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
      product_name VARCHAR(180) NOT NULL,
      unit_price BIGINT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body VARCHAR(1000) NOT NULL,
      photo_data TEXT,
      verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(product_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
  `);

  const count = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (count.rows[0].count === 0) {
    for (const p of seedProducts) {
      await pool.query(`INSERT INTO products (id,name,category,price,old_price,image,description,specifications,dimensions,color,stock)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, p);
    }
    await pool.query(`SELECT setval(pg_get_serial_sequence('products','id'), (SELECT MAX(id) FROM products))`);
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin'`, ['مدیر ویترین', adminEmail, hash]);
    console.log(`Admin account is ready for ${adminEmail}`);
  }
}

function signToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET_NOT_CONFIGURED');
  return jwt.sign({ sub: String(user.id), role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return required ? res.status(401).json({ message: 'برای ادامه وارد حساب کاربری شو.' }) : next();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ message: 'نشست شما معتبر نیست؛ دوباره وارد شو.' });
    }
  };
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'این بخش فقط برای مدیر فروشگاه است.' });
  next();
}
const publicProduct = (row) => ({ ...row, price: Number(row.price), oldPrice: row.old_price == null ? null : Number(row.old_price), stock: Number(row.stock), image: row.image });

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', service: 'vitrin-store' }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 80);
    const category = String(req.query.category || '').trim().slice(0, 80);
    const result = await pool.query(`SELECT p.*, COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS rating, COUNT(r.id)::int AS review_count
      FROM products p LEFT JOIN reviews r ON r.product_id=p.id WHERE p.active=TRUE
      AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.category ILIKE '%'||$1||'%')
      AND ($2='' OR p.category=$2) GROUP BY p.id ORDER BY p.created_at DESC, p.id`, [term, category]);
    res.json(result.rows.map(publicProduct));
  } catch (err) { next(err); }
});
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT p.*, COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS rating,
      COUNT(r.id)::int AS review_count FROM products p LEFT JOIN reviews r ON r.product_id=p.id
      WHERE p.id=$1 AND p.active=TRUE GROUP BY p.id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'محصول پیدا نشد.' });
    res.json(publicProduct(result.rows[0]));
  } catch (err) { next(err); }
});
app.get('/api/products/:id/reviews', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT r.id,r.rating,r.body,r.photo_data,r.verified_purchase,r.created_at,u.name
      FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=$1 ORDER BY r.created_at DESC`, [req.params.id]);
    res.json(result.rows.map(r => ({ id:r.id, rating:r.rating, text:r.body, photo:r.photo_data, verified:r.verified_purchase, createdAt:r.created_at, name:r.name })));
  } catch (err) { next(err); }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 72)
      return res.status(400).json({ message: 'نام، ایمیل معتبر و گذرواژه حداقل ۸ کاراکتری وارد کن.' });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role', [name,email,hash]);
    const user = result.rows[0]; res.status(201).json({ token: signToken(user), user });
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است.' }); next(err); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const result = await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1', [email]);
    if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) return res.status(401).json({ message: 'ایمیل یا گذرواژه درست نیست.' });
    const { password_hash, ...user } = result.rows[0]; res.json({ token: signToken(user), user });
  } catch (err) { next(err); }
});
app.get('/api/auth/me', auth(), async (req, res, next) => {
  try { const r = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.sub]); if (!r.rowCount) return res.status(401).json({message:'حساب کاربری پیدا نشد.'}); res.json(r.rows[0]); }
  catch (err) { next(err); }
});

app.post('/api/products/:id/reviews', auth(), async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    const body = String(req.body.text || '').trim();
    const photo = req.body.photo ? String(req.body.photo) : null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 5 || body.length > 1000) return res.status(400).json({ message: 'امتیاز ۱ تا ۵ و متن نظر بین ۵ تا ۱۰۰۰ نویسه لازم است.' });
    if (photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > 950000)) return res.status(400).json({ message: 'عکس باید JPG، PNG یا WebP و کمتر از ۷۰۰ کیلوبایت باشد.' });
    const p = await pool.query('SELECT id FROM products WHERE id=$1 AND active=TRUE', [req.params.id]);
    if (!p.rowCount) return res.status(404).json({ message: 'محصول پیدا نشد.' });
    const verified = await pool.query(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE oi.product_id=$1 AND o.user_id=$2 AND o.status='delivered' LIMIT 1`, [req.params.id, req.user.sub]);
    const result = await pool.query(`INSERT INTO reviews(product_id,user_id,rating,body,photo_data,verified_purchase)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id,rating,body,photo_data,verified_purchase,created_at`, [req.params.id,req.user.sub,rating,body,photo,verified.rowCount>0]);
    const r = result.rows[0]; res.status(201).json({ id:r.id,rating:r.rating,text:r.body,photo:r.photo_data,verified:r.verified_purchase,createdAt:r.created_at });
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'برای این محصول قبلاً نظر ثبت کرده‌ای.' }); next(err); }
});

app.post('/api/orders', auth(), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const customerName = String(req.body.customerName || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const postalCode = String(req.body.postalCode || '').trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (customerName.length < 2 || !/^[0-9+()\-\s]{8,20}$/.test(phone) || address.length < 10 || items.length < 1 || items.length > 30) return res.status(400).json({ message: 'اطلاعات گیرنده، شماره تماس، نشانی و اقلام سفارش را کامل کن.' });
    await client.query('BEGIN');
    let total = 0; const validated = [];
    for (const item of items) {
      const id = Number(item.id), quantity = Number(item.quantity);
      if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw Object.assign(new Error('تعداد یا شناسه محصول معتبر نیست.'), { status:400 });
      const p = await client.query('SELECT id,name,price,stock FROM products WHERE id=$1 AND active=TRUE FOR UPDATE', [id]);
      if (!p.rowCount) throw Object.assign(new Error('یکی از محصولات دیگر موجود نیست.'), { status:409 });
      const product = p.rows[0];
      if (Number(product.stock) < quantity) throw Object.assign(new Error(`موجودی «${product.name}» کافی نیست.`), { status:409 });
      total += Number(product.price) * quantity; validated.push({ ...product, quantity });
    }
    const order = await client.query(`INSERT INTO orders(user_id,customer_name,phone,address,postal_code,total)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id,total,status,created_at`, [req.user.sub,customerName,phone,address,postalCode,total]);
    for (const p of validated) {
      await client.query('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity) VALUES($1,$2,$3,$4,$5)', [order.rows[0].id,p.id,p.name,p.price,p.quantity]);
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [p.quantity,p.id]);
    }
    await client.query('COMMIT'); res.status(201).json({ ...order.rows[0], total:Number(order.rows[0].total), message:'سفارش با موفقیت ثبت شد. پرداخت در محل انتخاب شده است.' });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});
app.get('/api/orders/my', auth(), async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT o.id,o.total,o.status,o.payment_status,o.created_at,
      COALESCE(json_agg(json_build_object('name',oi.product_name,'price',oi.unit_price,'quantity',oi.quantity)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
      FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.sub]);
    res.json(r.rows.map(x=>({...x,total:Number(x.total)})));
  } catch (err) { next(err); }
});

app.get('/api/admin/summary', auth(), adminOnly, async (_req,res,next) => {
  try {
    const [p,o,u,r] = await Promise.all([pool.query('SELECT COUNT(*)::int AS n FROM products WHERE active=TRUE'),pool.query('SELECT COUNT(*)::int AS n FROM orders'),pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role='customer'"),pool.query('SELECT COUNT(*)::int AS n FROM reviews')]);
    res.json({products:p.rows[0].n,orders:o.rows[0].n,customers:u.rows[0].n,reviews:r.rows[0].n});
  } catch(err){next(err);}
});
app.post('/api/admin/products', auth(), adminOnly, async (req,res,next) => {
  try {
    const {name,category,price,image,description,specifications,dimensions,color,stock,oldPrice} = req.body;
    const imageValue=String(image||'assets/vase.svg');
    if (!String(name||'').trim() || !String(category||'').trim() || !Number.isSafeInteger(Number(price)) || Number(price)<=0 || !((imageValue.startsWith('assets/') && !imageValue.includes('..')) || /^https:\/\//i.test(imageValue))) return res.status(400).json({message:'نام، دسته‌بندی، قیمت معتبر و نشانی تصویر مجاز الزامی است.'});
    const r=await pool.query(`INSERT INTO products(name,category,price,old_price,image,description,specifications,dimensions,color,stock)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[String(name).trim(),String(category).trim(),Number(price),oldPrice?Number(oldPrice):null,imageValue,String(description||''),String(specifications||''),String(dimensions||''),String(color||''),Math.max(0,Number(stock)||0)]);
    res.status(201).json(publicProduct(r.rows[0]));
  } catch(err){next(err);}
});
app.put('/api/admin/products/:id', auth(), adminOnly, async (req,res,next) => {
  try {
    const {name,category,price,oldPrice,image,description,specifications,dimensions,color,stock,active} = req.body;
    const imageValue=String(image||'assets/vase.svg');
    if (!String(name||'').trim() || !String(category||'').trim() || !Number.isSafeInteger(Number(price)) || Number(price)<=0 || !Number.isInteger(Number(stock)) || Number(stock)<0 || !((imageValue.startsWith('assets/') && !imageValue.includes('..')) || /^https:\/\//i.test(imageValue))) return res.status(400).json({message:'اطلاعات محصول معتبر نیست.'});
    const r=await pool.query(`UPDATE products SET name=$1,category=$2,price=$3,old_price=$4,image=$5,description=$6,specifications=$7,dimensions=$8,color=$9,stock=$10,active=$11 WHERE id=$12 RETURNING *`,[String(name).trim(),String(category).trim(),Number(price),oldPrice?Number(oldPrice):null,imageValue,String(description||''),String(specifications||''),String(dimensions||''),String(color||''),Number(stock),active!==false,req.params.id]);
    if(!r.rowCount)return res.status(404).json({message:'محصول پیدا نشد.'}); res.json(publicProduct(r.rows[0]));
  } catch(err){next(err);}
});
app.delete('/api/admin/products/:id', auth(), adminOnly, async (req,res,next) => {
  try { const r=await pool.query('UPDATE products SET active=FALSE WHERE id=$1 RETURNING id',[req.params.id]); if(!r.rowCount)return res.status(404).json({message:'محصول پیدا نشد.'}); res.json({message:'محصول از فروشگاه پنهان شد.'}); }
  catch(err){next(err);}
});
app.get('/api/admin/orders', auth(), adminOnly, async (_req,res,next) => {
  try { const r=await pool.query(`SELECT o.*,u.email,COALESCE(json_agg(json_build_object('name',oi.product_name,'quantity',oi.quantity)) FILTER(WHERE oi.id IS NOT NULL),'[]') AS items FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id,u.email ORDER BY o.created_at DESC LIMIT 200`); res.json(r.rows.map(x=>({...x,total:Number(x.total)}))); }
  catch(err){next(err);}
});
app.patch('/api/admin/orders/:id/status', auth(), adminOnly, async (req,res,next) => {
  const client=await pool.connect();
  try {
    const allowed=['pending','processing','shipped','delivered','cancelled']; const status=String(req.body.status);
    if(!allowed.includes(status))return res.status(400).json({message:'وضعیت سفارش معتبر نیست.'});
    await client.query('BEGIN');
    const current=await client.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!current.rowCount){await client.query('ROLLBACK');return res.status(404).json({message:'سفارش پیدا نشد.'});}
    const oldStatus=current.rows[0].status;
    if(oldStatus==='cancelled' && status!=='cancelled'){await client.query('ROLLBACK');return res.status(409).json({message:'سفارش لغوشده قابل بازگردانی خودکار نیست.'});}
    if(status==='cancelled' && oldStatus!=='cancelled'){
      if(['shipped','delivered'].includes(oldStatus)){await client.query('ROLLBACK');return res.status(409).json({message:'سفارش ارسال‌شده یا تحویل‌شده را از این بخش نمی‌توان لغو کرد.'});}
      await client.query(`UPDATE products p SET stock=p.stock+oi.quantity FROM order_items oi WHERE oi.order_id=$1 AND oi.product_id=p.id`,[req.params.id]);
    }
    const result=await client.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status',[status,req.params.id]);
    await client.query('COMMIT');res.json(result.rows[0]);
  } catch(err){await client.query('ROLLBACK');next(err);} finally{client.release();}
});

app.use('/api', (_req,res) => res.status(404).json({message:'مسیر API پیدا نشد.'}));
app.use(express.static(projectRoot, { extensions:['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*', (_req,res) => res.sendFile(path.join(projectRoot,'index.html')));
app.use((err,_req,res,_next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({message: status < 500 ? err.message : 'خطای داخلی سرور. دوباره تلاش کن.'});
});

try {
  await initializeDatabase();
  app.listen(PORT, () => console.log(`Vitrin is running on port ${PORT}`));
} catch (err) {
  console.error('Startup failed:', err);
  process.exit(1);
}
