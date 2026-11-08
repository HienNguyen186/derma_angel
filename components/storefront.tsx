"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, Heart, Menu, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star, UserRound, X } from "lucide-react";
import type { Product } from "@/lib/store";
import { ProductArt } from "./product-art";

type CartItem = { id: string; quantity: number };
type Order = Record<string, any>;
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const fanpage = "https://www.facebook.com/profile.php?id=61596042543696";
const moodCopy: Record<string, string> = { glitter: "Một chút ánh sáng cho ngày thật nổi bật.", panda: "Dịu dàng theo cách rất riêng.", "cute-paws": "Vui tươi cùng những dấu chân nhỏ.", hologram: "Đổi góc nhìn, đổi sắc màu.", kitties: "Đáng yêu chẳng cần lý do." };

export function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("all");
  const [sort, setSort] = useState("featured");
  const [stockOnly, setStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawer, setDrawer] = useState<"cart" | "checkout" | "track" | "account" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [reviews, setReviews] = useState<any[]>([]);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Order | null>(null);
  const [tracked, setTracked] = useState<Order | null>(null);
  const [trackCode, setTrackCode] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [checkout, setCheckout] = useState({ customerName: "", phone: "", email: "", address: "", province: "", district: "", ward: "", note: "", paymentMethod: "cod" });
  const [reviewDraft, setReviewDraft] = useState({ productId: "", rating: 5, body: "" });

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("da-cart") || "[]")); } catch { setCart([]); }
    const savedConsent = localStorage.getItem("da-analytics-consent");
    setConsent(savedConsent === null ? null : savedConsent === "yes");
    fetch("/api/catalog").then(r => r.json()).then((data:any) => { if (data.error) throw new Error(data.error); setProducts(data.products || []); }).catch(() => setError("Không tải được bộ sưu tập. Vui lòng thử lại.")).finally(() => setLoading(false));
    fetch("/api/favorites").then(r => r.ok ? r.json() : { ids: [] }).then((data:any) => setFavorites(data.ids || [])).catch(() => {});
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("product");
    const product = products.find(p => p.id === id);
    if (product) void openDetail(product, false);
  }, [products]);
  useEffect(() => { localStorage.setItem("da-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!consent) return;
    const key = `da-visit-${location.pathname}-${new Date().toISOString().slice(0,10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: location.pathname, consent: true }) }).catch(() => {});
  }, [consent]);

  const filtered = useMemo(() => {
    let result = products.filter(p => (mood === "all" || p.id === mood) && (!stockOnly || p.stock > 0) &&
      (!maxPrice || p.price <= maxPrice) && (!minRating || (p.rating || 0) >= minRating) &&
      (!query || `${p.name} ${p.mood} ${p.sku}`.toLowerCase().includes(query.toLowerCase())));
    if (sort === "price-asc") result = [...result].sort((a,b) => a.price-b.price);
    if (sort === "price-desc") result = [...result].sort((a,b) => b.price-a.price);
    if (sort === "best") result = [...result].sort((a,b) => (b.sold || 0)-(a.sold || 0));
    if (sort === "new") result = [...result].sort((a,b) => b.created_at.localeCompare(a.created_at));
    return result;
  }, [products, mood, query, stockOnly, sort, maxPrice, minRating]);
  const cartLines = cart.map(item => ({ ...item, product: products.find(p => p.id === item.id) })).filter(x => x.product) as { id: string; quantity: number; product: Product }[];
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const discount = voucher?.discount || 0;
  const total = subtotal - discount;
  const cartCount = cart.reduce((sum, x) => sum + x.quantity, 0);

  function add(product: Product, quantity = 1) {
    if (product.stock < 1) { setNotice("Sản phẩm đang chờ cập nhật tồn kho."); return; }
    setCart(previous => {
      const current = previous.find(x => x.id === product.id)?.quantity || 0;
      const next = Math.min(product.stock, current + quantity);
      return [...previous.filter(x => x.id !== product.id), { id: product.id, quantity: next }];
    });
    setNotice(`Đã thêm ${product.name} vào giỏ hàng.`);
    setDrawer("cart");
  }
  function changeQuantity(id: string, quantity: number) {
    const max = products.find(p => p.id === id)?.stock || 0;
    setCart(previous => quantity <= 0 ? previous.filter(x => x.id !== id) : previous.map(x => x.id === id ? { ...x, quantity: Math.min(max, quantity) } : x));
    setVoucher(null);
  }
  async function openDetail(product: Product, updateUrl = true) {
    if (updateUrl) history.replaceState(null, "", `/?product=${encodeURIComponent(product.id)}`);
    setSelected(product); setDetailQuantity(1); setReviews([]);
    try { const data:any = await fetch(`/api/catalog?id=${encodeURIComponent(product.id)}`).then(r => r.json()); setReviews(data.reviews || []); } catch {}
  }
  function closeDetail() { setSelected(null); history.replaceState(null, "", "/"); }
  async function toggleFavorite(product: Product) {
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
      const data:any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFavorites(previous => data.favorite ? [...previous, product.id] : previous.filter(id => id !== product.id));
      setNotice(data.favorite ? `Đã lưu ${product.name} vào yêu thích.` : `Đã bỏ ${product.name} khỏi yêu thích.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không lưu được yêu thích."); }
  }
  async function applyVoucher() {
    setNotice("");
    try {
      const response = await fetch("/api/voucher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: voucherInput, subtotal }) });
      const data:any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVoucher(data); setNotice(`Đã áp dụng mã ${data.code}.`);
    } catch (e) { setVoucher(null); setNotice(e instanceof Error ? e.message : "Mã chưa hợp lệ."); }
  }
  async function placeOrder(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...checkout, items: cart, voucherCode: voucher?.code || "" }) });
      const data:any = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đặt hàng.");
      setSuccess(data.order); setCart([]); setVoucher(null); setDrawer(null);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Không thể đặt hàng."); }
    finally { setSubmitting(false); }
  }
  async function track(event: FormEvent) {
    event.preventDefault(); setNotice(""); setTracked(null);
    try {
      const response = await fetch(`/api/orders?code=${encodeURIComponent(trackCode)}&phone=${encodeURIComponent(trackPhone)}`);
      const data:any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTracked(data.order);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Không tìm thấy đơn hàng."); }
  }
  async function openAccount() {
    setDrawer("account"); setNotice("");
    try { const response = await fetch("/api/orders?mine=1"); const data:any = await response.json(); setSignedIn(response.ok); setMyOrders(data.orders || []); } catch { setMyOrders([]); setSignedIn(false); }
  }
  async function submitReview(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...reviewDraft, code: trackCode, phone: trackPhone }) });
      const data:any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(data.message); setReviewDraft({ productId: "", rating: 5, body: "" });
    } catch (e) { setNotice(e instanceof Error ? e.message : "Không gửi được đánh giá."); }
  }
  function chooseMood(id: string) { setMood(id); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }
  function setAnalytics(value: boolean) { localStorage.setItem("da-analytics-consent", value ? "yes" : "no"); setConsent(value); }

  return <div className="site-shell">
    <div className="announcement"><Sparkles size={14} /> Dán đúng Mood, Diện đúng Mốt <span>✦</span> 5 thiết kế để là chính mình</div>
    <header className="store-header">
      <a href="#top" className="brand"><img src="/dermaangel-logo.png" alt="DermaAngel" width="1086" height="362" /></a>
      <nav className={mobileMenu ? "nav-open" : ""} aria-label="Điều hướng chính">
        <a href="#top" onClick={() => setMobileMenu(false)}>Trang chủ</a><a href="#collection" onClick={() => setMobileMenu(false)}>Cửa hàng</a>
        <a href="#moods" onClick={() => setMobileMenu(false)}>Bộ sưu tập</a><a href="#offers" onClick={() => setMobileMenu(false)}>Combo & ưu đãi</a>
        <a href="#story" onClick={() => setMobileMenu(false)}>Về DermaAngel</a><a href="#contact" onClick={() => setMobileMenu(false)}>Liên hệ</a>
      </nav>
      <div className="header-actions">
        <button aria-label="Tìm kiếm" onClick={() => document.getElementById("shop-search")?.focus()}><Search size={20} /></button>
        <button aria-label="Tài khoản và đơn hàng" onClick={openAccount}><UserRound size={20} /></button>
        <button aria-label={`Giỏ hàng ${cartCount} sản phẩm`} onClick={() => setDrawer("cart")} className="cart-trigger"><ShoppingBag size={20} />{cartCount > 0 && <b>{cartCount}</b>}</button>
        <button className="mobile-toggle" aria-label="Mở menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22} /></button>
      </div>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line"/> MOOD IN THE CLOUDS <span className="eyebrow-star">✦</span></div>
            <h1>Dán đúng <em>Mood,</em><br/>Diện đúng <em>Mốt.</em></h1>
            <p>Miếng dán mụn DermaAngel — 5 thiết kế, 5 cách thể hiện cá tính. Chăm sóc bản thân theo cách mình yêu thích.</p>
            <div className="hero-buttons"><a className="button button-primary" href="#collection">Khám phá bộ sưu tập <ArrowRight size={17}/></a><a className="button button-light" href="#moods">Chọn mood của bạn</a></div>
            <div className="hero-foot"><span><i/> 5 thiết kế</span><span><i/> Giá tham chiếu 63.000 ₫/hộp</span></div>
          </div>
          <div className="hero-visual"><div className="hero-ring"/><img src="/products-hero.png" alt="Năm bao bì gốc DermaAngel: Glitter, Panda, Cute Paws, Hologram và Kitties" width="1383" height="922" fetchPriority="high"/><span className="hero-sticker">your skin<br/><b>your mood</b><small>✧</small></span></div>
        </div>
        <div className="cloud-floor"/><div className="hero-bottom-text">OWN YOUR MOOD <span>✦</span> OWN YOUR STYLE <span>✦</span> OWN YOUR MOOD <span>✦</span> OWN YOUR STYLE</div>
      </section>

      <section className="promise-row container" aria-label="Điểm nổi bật"><div><span>01</span><b>Chọn thiết kế hợp gu</b><small>5 mood, 5 cách thể hiện</small></div><div><span>02</span><b>Ảnh bao bì từ proposal</b><small>Hình sản phẩm gốc được cung cấp</small></div><div><span>03</span><b>Mua sắm rõ ràng</b><small>Giá và trạng thái tồn kho minh bạch</small></div></section>

      <section className="section collection-section" id="collection"><div className="container">
        <div className="section-heading"><div><span className="kicker">THE COLLECTION ✦</span><h2>Chọn một <em>mood</em> cho hôm nay</h2><p>Mỗi thiết kế là một nét cá tính. Bạn thích phiên bản nào?</p></div><div className="section-deco">✳</div></div>
        <div className="shop-tools"><div className="mood-tabs" role="group" aria-label="Lọc thiết kế">{[["all","Tất cả"], ...products.map(p => [p.id,p.name])].map(([id,name]) => <button key={id} className={mood === id ? "active" : ""} onClick={() => setMood(id)}>{name}</button>)}</div><div className="filter-row"><label className="search-field"><Search size={17}/><input id="shop-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm thiết kế..." aria-label="Tìm sản phẩm" /></label><label className="sort-field"><SlidersHorizontal size={16}/><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sắp xếp sản phẩm"><option value="featured">Nổi bật</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option><option value="best">Bán chạy</option><option value="new">Mới nhất</option></select><ChevronDown size={14}/></label><label className="stock-filter"><input type="checkbox" checked={stockOnly} onChange={e => setStockOnly(e.target.checked)}/> Còn hàng</label><select className="extra-filter" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} aria-label="Lọc theo giá"><option value="0">Mọi mức giá</option><option value="63000">Đến 63.000 ₫</option><option value="100000">Đến 100.000 ₫</option></select><select className="extra-filter" value={minRating} onChange={e => setMinRating(Number(e.target.value))} aria-label="Lọc theo đánh giá"><option value="0">Mọi đánh giá</option><option value="4">Từ 4 sao</option><option value="4.5">Từ 4,5 sao</option></select></div></div>
        {loading ? <div className="loading-grid">{[1,2,3,4,5].map(x => <div key={x} className="skeleton-card"/>)}</div> : error ? <div className="empty-state">{error}<button onClick={() => location.reload()}>Thử lại</button></div> : filtered.length ? <div className="product-grid">{filtered.map((p,i) => <article className={`product-card tone-${p.id}`} key={p.id}><div className="card-top"><span className="card-index">0{i+1} / 05</span><button aria-label={favorites.includes(p.id) ? `Bỏ ${p.name} khỏi yêu thích` : `Lưu ${p.name} vào yêu thích`} onClick={() => toggleFavorite(p)} className={`card-heart ${favorites.includes(p.id) ? "is-favorite" : ""}`}><Heart size={18} fill={favorites.includes(p.id) ? "currentColor" : "none"}/></button></div><button className="card-art-button" onClick={() => openDetail(p)} aria-label={`Xem chi tiết ${p.name}`}><ProductArt product={p}/></button><div className="card-info"><span className="card-mood">{p.mood} mood</span><h3>Acne Beauty Patch <strong>{p.name}</strong></h3><div className="card-rating"><Star size={14} fill={p.rating ? "currentColor" : "none"}/>{p.rating ? `${p.rating} (${p.review_count})` : "Chưa có đánh giá"}<span>·</span>{p.sold ? `Đã bán ${p.sold}` : "Chưa có lượt mua"}</div><div className="card-price-row"><b>{money(p.price)}</b><span className={p.stock ? "in-stock" : "out-stock"}>{p.stock ? `Còn ${p.stock}` : "Chờ cập nhật tồn kho"}</span></div><div className="card-buttons"><button className="button card-detail" onClick={() => openDetail(p)}>Xem chi tiết</button><button className="button card-add" onClick={() => add(p)} disabled={p.stock < 1}><ShoppingBag size={16}/> Thêm giỏ</button></div></div></article>)}</div> : <div className="empty-state">Chưa có sản phẩm phù hợp với bộ lọc. <button onClick={() => {setMood("all");setQuery("");setStockOnly(false);}}>Xóa bộ lọc</button></div>}
      </div></section>

      <section className="mood-section section" id="moods"><div className="container mood-layout"><div><span className="kicker">FIND YOUR KIND OF MAGIC</span><h2>Hôm nay bạn là <em>mood</em> nào?</h2><p>Không có một kiểu chăm sóc bản thân cho tất cả mọi người. Hãy chọn thiết kế khiến bạn mỉm cười.</p><div className="mood-pills">{products.map(p => <button key={p.id} onClick={() => chooseMood(p.id)} className={mood === p.id ? "selected" : ""}>✦ {p.name}</button>)}</div></div><div className="mood-feature"><span className="floating-star">✧</span><div className="mood-feature-art">{products.length > 0 && <ProductArt product={products.find(p => p.id === (mood === "all" ? "hologram" : mood)) || products[0]} large/>}</div><div><small>YOUR CURRENT MOOD</small><h3>{products.find(p => p.id === mood)?.name || "Hologram"}</h3><p>{moodCopy[mood === "all" ? "hologram" : mood]}</p></div></div></div></section>

      <section className="section offers-section" id="offers"><div className="container offers-layout"><div className="offers-mark">✳</div><div><span className="kicker">COMBO & SPECIAL OFFERS</span><h2>Niềm vui sẽ <em>đến cùng nhau</em></h2><p>Combo 3 hộp, bộ 5 mẫu và giftset sẽ xuất hiện tại đây khi đội ngũ kích hoạt chương trình cùng giá, thời hạn và số lượng quà tặng chính thức.</p><span className="waiting-badge">Chưa có ưu đãi đang hoạt động</span></div><div className="offers-aside"><span>COMING SOON</span><b>5 moods.<br/>One little cloud.</b><div className="doodle">♡ ✦ ☁</div></div></div></section>

      <section className="section story-section" id="story"><div className="container story-layout"><div className="story-card"><span className="story-big-star">✦</span><img src="/products-hero.png" alt="Bộ sưu tập năm mẫu DermaAngel" width="1383" height="922" loading="lazy"/><span className="story-mini">Dán đúng mood<br/>diện đúng mốt</span></div><div className="story-copy"><span className="kicker">HELLO, DERMAANGEL</span><h2>Đẹp theo cách <em>mình thích.</em></h2><p>Chăm sóc bản thân là một hành trình rất riêng. DermaAngel mang đến những thiết kế để bạn có thể chọn theo gu, vui với lựa chọn ấy và tự tin thể hiện cá tính mỗi ngày.</p><p>Thông điệp của chúng mình đơn giản: cứ là bạn, theo cách bạn yêu thích.</p><a href={fanpage} target="_blank" rel="noreferrer" className="text-link">Ghé Fanpage DermaAngel <ArrowRight size={17}/></a></div></div></section>

      <section className="social-section" id="contact"><div className="container social-layout"><div><span className="kicker">STAY IN OUR CLOUD</span><h2>Cùng nhau <em>chia sẻ mood.</em></h2><p>Khám phá hoạt động mới nhất và trò chuyện với DermaAngel trên Fanpage chính thức.</p></div><div className="social-actions"><a className="button button-primary" href={fanpage} target="_blank" rel="noreferrer">Theo dõi Facebook <ArrowRight size={17}/></a><a className="button button-light" href={fanpage} target="_blank" rel="noreferrer">Liên hệ Fanpage</a></div></div></section>
    </main>

    <footer className="footer"><div className="container footer-grid"><div><img src="/dermaangel-logo.png" alt="DermaAngel" width="1086" height="362"/><p>Mood in the Clouds.<br/>Your Skin, Your Mood, Your Style.</p></div><div><b>Khám phá</b><a href="#collection">Cửa hàng</a><a href="#moods">Bộ sưu tập</a><a href="#offers">Combo & ưu đãi</a></div><div><b>Hỗ trợ</b><button onClick={() => setDrawer("track")}>Tra cứu đơn hàng</button><a href={fanpage} target="_blank" rel="noreferrer">Liên hệ Fanpage</a><span>Chính sách giao hàng, đổi trả sẽ được công bố trước khi mở bán.</span></div><div><b>Kết nối</b><a href={fanpage} target="_blank" rel="noreferrer">Facebook ↗</a><a href="/admin">Business Admin ↗</a></div></div><div className="container footer-bottom"><span>© 2026 DermaAngel. Hình bao bì từ tài liệu proposal được cung cấp.</span><span>Made for every mood ✦</span></div></footer>

    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Đóng thông báo"><X size={16}/></button></div>}
    {consent === null && <div className="consent-banner"><div><b>Quyền riêng tư của bạn</b><p>Chúng mình chỉ ghi nhận lượt truy cập nội bộ khi bạn đồng ý. Không có công cụ quảng cáo nào được bật ở đây.</p></div><div><button onClick={() => setAnalytics(false)}>Từ chối</button><button className="button-primary" onClick={() => setAnalytics(true)}>Đồng ý</button></div></div>}

    {selected && <div className="modal-backdrop" onMouseDown={closeDetail}><div className="detail-modal" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selected.name}`} onMouseDown={e => e.stopPropagation()}><button className="close" onClick={closeDetail} aria-label="Đóng"><X/></button><div className={`detail-art tone-${selected.id}`}><ProductArt product={selected} large/><small>Ảnh bao bì gốc từ proposal</small></div><div className="detail-content"><span className="kicker">DERMAANGEL / {selected.sku}</span><h2>Acne Beauty Patch <em>{selected.name}</em></h2><p className="detail-price">{money(selected.price)}</p><div className="detail-meta"><span><Star size={16}/>{selected.rating ? `${selected.rating} · ${selected.review_count} đánh giá` : "Chưa có đánh giá"}</span><span>{selected.stock ? `Còn ${selected.stock} hộp` : "Chờ cập nhật tồn kho"}</span></div><p>{selected.description}</p><div className="detail-note"><b>Về thiết kế</b><span>{moodCopy[selected.id] || selected.mood}</span></div><div className="detail-note"><b>Hướng dẫn sử dụng</b><span>Đang chờ tài liệu sản phẩm chính thức từ nhà phân phối.</span></div><div className="detail-buy"><div className="quantity-stepper"><button onClick={() => setDetailQuantity(Math.max(1,detailQuantity-1))} aria-label="Giảm số lượng"><Minus size={16}/></button><span>{detailQuantity}</span><button onClick={() => setDetailQuantity(Math.min(selected.stock,detailQuantity+1))} aria-label="Tăng số lượng" disabled={!selected.stock}><Plus size={16}/></button></div><button className="button button-primary" disabled={!selected.stock} onClick={() => {add(selected,detailQuantity);closeDetail();}}>Thêm vào giỏ <ShoppingBag size={17}/></button></div><button className="share-link" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${location.origin}/?product=${selected.id}`)}`, "_blank")}>Chia sẻ sản phẩm lên Facebook ↗</button><div className="detail-reviews"><b>Đánh giá đã duyệt</b>{reviews.length ? reviews.map(r => <div key={r.id}><span>{"★".repeat(r.rating)} · {r.display_name}</span><p>{r.body}</p></div>) : <p>Chưa có đánh giá. Đánh giá chỉ hiển thị sau khi được duyệt.</p>}</div></div></div></div>}

    {drawer && <div className="drawer-backdrop" onMouseDown={() => {setDrawer(null);setTracked(null);}}><aside className="drawer" role="dialog" aria-modal="true" aria-label={drawer === "cart" ? "Giỏ hàng" : drawer === "checkout" ? "Thanh toán" : "Đơn hàng"} onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><small>DERMAANGEL</small><h2>{drawer === "cart" ? "Giỏ hàng của bạn" : drawer === "checkout" ? "Thông tin đặt hàng" : drawer === "track" ? "Tra cứu đơn hàng" : "Tài khoản & đơn hàng"}</h2></div><button onClick={() => {setDrawer(null);setTracked(null);}} aria-label="Đóng"><X/></button></div>
      {drawer === "cart" && <div className="drawer-body">{cartLines.length ? <><div className="cart-lines">{cartLines.map(({id,quantity,product}) => <div className="cart-line" key={id}><ProductArt product={product}/><div><b>{product.name}</b><small>{money(product.price)} / hộp</small><div className="quantity-stepper"><button onClick={() => changeQuantity(id,quantity-1)} aria-label={`Giảm ${product.name}`}><Minus size={14}/></button><span>{quantity}</span><button onClick={() => changeQuantity(id,quantity+1)} disabled={quantity >= product.stock} aria-label={`Tăng ${product.name}`}><Plus size={14}/></button></div></div><button onClick={() => changeQuantity(id,0)} aria-label={`Xóa ${product.name}`}><X size={16}/></button></div>)}</div><div className="voucher-row"><input value={voucherInput} onChange={e => setVoucherInput(e.target.value)} placeholder="Mã ưu đãi" aria-label="Mã ưu đãi"/><button onClick={applyVoucher} disabled={!voucherInput}>Áp dụng</button></div><div className="totals"><div><span>Tạm tính</span><b>{money(subtotal)}</b></div><div><span>Ưu đãi</span><b>−{money(discount)}</b></div><div><span>Phí vận chuyển</span><b>Chờ xác nhận</b></div><div className="grand-total"><span>Tổng tạm tính</span><b>{money(total)}</b></div><small>Phí vận chuyển sẽ được xác nhận khi xử lý đơn. Thanh toán chưa được ghi nhận.</small></div><button className="button button-primary full" onClick={() => setDrawer("checkout")}>Tiếp tục đặt hàng <ArrowRight size={17}/></button></> : <div className="drawer-empty"><ShoppingBag size={46}/><h3>Giỏ hàng đang chờ mood mới</h3><p>Hãy chọn một thiết kế bạn yêu thích để bắt đầu.</p><button className="button button-primary" onClick={() => {setDrawer(null);document.getElementById("collection")?.scrollIntoView({behavior:"smooth"});}}>Khám phá bộ sưu tập</button></div>}</div>}
      {drawer === "checkout" && <form className="drawer-body checkout-form" onSubmit={placeOrder}><p className="checkout-intro">Đơn hàng sẽ ở trạng thái chờ xác nhận. Chúng mình sẽ liên hệ để chốt phí giao hàng và thanh toán.</p>{[["customerName","Họ và tên *"],["phone","Số điện thoại *"],["email","Email (không bắt buộc)"],["address","Địa chỉ nhận hàng *"],["province","Tỉnh / thành phố *"],["district","Quận / huyện *"],["ward","Phường / xã *"]].map(([key,label]) => <label key={key}>{label}<input required={key !== "email"} type={key === "email" ? "email" : "text"} value={checkout[key as keyof typeof checkout]} onChange={e => setCheckout({...checkout,[key]:e.target.value})}/></label>)}<label>Ghi chú đơn hàng<textarea value={checkout.note} onChange={e => setCheckout({...checkout,note:e.target.value})}/></label><fieldset><legend>Phương thức thanh toán</legend><label><input type="radio" name="payment" checked={checkout.paymentMethod === "cod"} onChange={() => setCheckout({...checkout,paymentMethod:"cod"})}/> Thanh toán khi nhận hàng (COD)</label><label><input type="radio" name="payment" checked={checkout.paymentMethod === "bank_transfer"} onChange={() => setCheckout({...checkout,paymentMethod:"bank_transfer"})}/> Chuyển khoản — chờ hướng dẫn xác nhận</label></fieldset><div className="totals"><div><span>{cartCount} sản phẩm</span><b>{money(subtotal)}</b></div><div><span>Ưu đãi</span><b>−{money(discount)}</b></div><div className="grand-total"><span>Tổng tạm tính</span><b>{money(total)}</b></div><small>Chưa bao gồm phí vận chuyển. Không có giao dịch thanh toán tự động.</small></div><button className="button button-primary full" disabled={submitting || !cartLines.length}>{submitting ? "Đang lưu đơn..." : "Đặt hàng · Chờ xác nhận"}</button><button type="button" className="back-link" onClick={() => setDrawer("cart")}>← Quay lại giỏ hàng</button></form>}
      {drawer === "track" && <div className="drawer-body"><p className="checkout-intro">Nhập mã đơn và số điện thoại đã dùng khi đặt hàng.</p><form className="track-form" onSubmit={track}><label>Mã đơn hàng<input value={trackCode} onChange={e => setTrackCode(e.target.value)} required placeholder="DA-..."/></label><label>Số điện thoại<input value={trackPhone} onChange={e => setTrackPhone(e.target.value)} required placeholder="0..."/></label><button className="button button-primary full">Tra cứu đơn hàng</button></form>{tracked && <div className="tracked-order"><span className="status-pill">{tracked.status}</span><h3>{tracked.code}</h3><p>{tracked.customer_name} · {tracked.address}, {tracked.ward}, {tracked.district}, {tracked.province}</p><div className="totals"><div><span>Thanh toán</span><b>{tracked.payment_status}</b></div><div><span>Tổng tạm tính</span><b>{money(tracked.total)}</b></div><div><span>Phí vận chuyển</span><b>{tracked.shipping_fee == null ? "Chờ xác nhận" : money(tracked.shipping_fee)}</b></div></div>{tracked.items?.map((item:any) => <div className="tracked-item" key={item.product_id}>{item.name} × {item.quantity} <b>{money(item.price * item.quantity)}</b></div>)}{tracked.status === "delivered" && <form className="review-form" onSubmit={submitReview}><h4>Đánh giá sản phẩm đã nhận</h4><select required value={reviewDraft.productId} onChange={e => setReviewDraft({...reviewDraft,productId:e.target.value})}><option value="">Chọn sản phẩm</option>{tracked.items?.map((item:any) => <option key={item.product_id} value={item.product_id}>{item.name}</option>)}</select><select value={reviewDraft.rating} onChange={e => setReviewDraft({...reviewDraft,rating:Number(e.target.value)})}>{[5,4,3,2,1].map(x => <option key={x} value={x}>{x} sao</option>)}</select><textarea required minLength={8} placeholder="Chia sẻ trải nghiệm của bạn" value={reviewDraft.body} onChange={e => setReviewDraft({...reviewDraft,body:e.target.value})}/><button className="button button-primary full">Gửi đánh giá</button></form>}</div>}</div>}
      {drawer === "account" && <div className="drawer-body"><p className="checkout-intro">Đơn hàng đặt khi đăng nhập sẽ xuất hiện tại đây. Bạn vẫn có thể tra cứu đơn khách bằng mã đơn và số điện thoại.</p>{myOrders.length ? myOrders.map(o => <div className="account-order" key={o.code}><b>{o.code}</b><span>{new Date(o.created_at).toLocaleDateString("vi-VN")}</span><small>{o.status} · {money(o.total)}</small></div>) : <div className="drawer-empty"><UserRound size={40}/><h3>Chưa có đơn hàng</h3><p>Đơn đặt dưới dạng khách có thể tra cứu bằng mã đơn.</p></div>}{signedIn === false ? <a className="button button-primary full account-signin" href="/signin-with-chatgpt?return_to=/" target="_top">Đăng nhập để xem đơn hàng</a> : <a className="account-signout" href="/signout-with-chatgpt?return_to=/" target="_top">Đăng xuất</a>}<div className="account-favorites"><h3>Sản phẩm yêu thích</h3>{favorites.length ? favorites.map(id => { const p=products.find(item=>item.id===id); return p ? <button key={id} onClick={() => {setDrawer(null);openDetail(p);}}>{p.name} <span>→</span></button> : null; }) : <p>Chưa có sản phẩm yêu thích.</p>}</div><button className="button button-light full" onClick={() => setDrawer("track")}>Tra cứu bằng mã đơn</button></div>}
    </aside></div>}

    {success && <div className="modal-backdrop"><div className="success-card" role="dialog" aria-modal="true"><div className="success-icon"><Check size={32}/></div><span className="kicker">YOUR ORDER IS IN THE CLOUD</span><h2>Đã nhận đơn hàng!</h2><p>Đơn đang chờ xác nhận. Chúng mình sẽ liên hệ để xác nhận phí giao hàng và phương thức thanh toán.</p><div className="success-code">Mã đơn hàng <b>{success.code}</b></div><div className="success-summary"><span>{success.items?.map((x:any) => `${x.name} × ${x.quantity}`).join(", ")}</span><b>{money(success.total)}</b></div><small>Trạng thái: Chờ xác nhận · Chưa thanh toán</small><button className="button button-primary full" onClick={() => {setTrackCode(success.code);setTrackPhone(success.phone);setSuccess(null);setDrawer("track");}}>Theo dõi đơn hàng</button><button className="back-link" onClick={() => setSuccess(null)}>Tiếp tục khám phá</button></div></div>}
  </div>;
}


