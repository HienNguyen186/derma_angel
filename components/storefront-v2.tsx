"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, Heart, Menu, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import type { Product } from "@/lib/store";
import { ProductArt } from "./product-art";

type CartLine = { id: string; quantity: number; price?: number };
type Settings = { pickup_enabled: number; delivery_enabled: number; pickup_location: string; contact_url: string; shipping_policy: string; return_policy: string; privacy_contact: string };
type Offer = { code: string; kind: string; amount: number; min_subtotal: number; ends_at: string | null };
type Review = { id: string; rating: number; body: string; display_name: string; product_name: string; source: string; created_at: string };
type Order = Record<string, any>;
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const formVPage = "https://www.facebook.com/profile.php?id=61596042543696";
const dermaAngelPage = "https://www.facebook.com/dermaangelvn";
const moodCopy: Record<string, string> = {
  glitter: "Thêm chút lấp lánh cho ngày của bạn.",
  panda: "Dịu dàng một chút, đáng yêu một chút.",
  "cute-paws": "Một chút tinh nghịch, một ngày thêm vui.",
  hologram: "Đổi góc nhìn, đổi sắc màu.",
  kitties: "Chọn một nét đáng yêu của riêng bạn.",
};
const blankSettings: Settings = { pickup_enabled: 0, delivery_enabled: 0, pickup_location: "", contact_url: "", shipping_policy: "", return_policy: "", privacy_contact: "" };
const blankCheckout = { customerName: "", phone: "", email: "", receiveMethod: "", address: "", province: "", ward: "", district: "", note: "", orderConsent: false };
const blankReview = { source: "direct", code: "", phone: "", productId: "", displayName: "", rating: 0, body: "", consentPublic: false };

export function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(blankSettings);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<{average: number | null; count: number}>({ average: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("all");
  const [sort, setSort] = useState("featured");
  const [stockOnly, setStockOnly] = useState(false);
  const [priceFilter, setPriceFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawer, setDrawer] = useState<"cart" | "checkout" | "track" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detailReviews, setDetailReviews] = useState<Review[]>([]);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [policy, setPolicy] = useState<"purchase" | "privacy" | null>(null);
  const [checkout, setCheckout] = useState(blankCheckout);
  const [reviewDraft, setReviewDraft] = useState(blankReview);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<{code: string; discount: number} | null>(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [success, setSuccess] = useState<Order | null>(null);
  const [tracked, setTracked] = useState<Order | null>(null);
  const [trackCode, setTrackCode] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const requestKey = useRef("");
  const reviewRequestKey = useRef("");
  const previousFocus = useRef<HTMLElement | null>(null);
  const pageViewId = useRef<string | null>(null);

  async function refreshCatalog() {
    try {
      const response = await fetch("/api/catalog");
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data.products || []);
      setSettings(data.settings || blankSettings);
      setOffers(data.offers || []);
      setReviews(data.reviews || []);
      setRating(data.rating || { average: null, count: 0 });
      setLoadError("");
    } catch {
      setLoadError("Chưa tải được nội dung. Bạn thử lại nhé.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("da-cart") || "[]")); } catch { setCart([]); }
    try { setFavorites(JSON.parse(localStorage.getItem("da-favorites") || "[]")); } catch { setFavorites([]); }
    void refreshCatalog();
  }, []);
  useEffect(() => { localStorage.setItem("da-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("da-favorites", JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("product");
    const product = products.find(item => item.id === id);
    if (product) void openDetail(product, false);
  }, [products]);
  useEffect(() => {
    let inFlight = false;
    let recorded = false;
    async function recordVisit() {
      if (document.visibilityState === "hidden" || inFlight || recorded) return;
      if (!pageViewId.current) pageViewId.current = crypto.randomUUID();
      inFlight = true;
      try {
        const response = await fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageViewId: pageViewId.current }) });
        const data: any = await response.json();
        if (response.ok && data.recorded) recorded = true;
      } catch { /* Retry when the page becomes active again. */ }
      finally { inFlight = false; }
    }
    void recordVisit();
    window.addEventListener("focus", recordVisit);
    document.addEventListener("visibilitychange", recordVisit);
    return () => { window.removeEventListener("focus", recordVisit); document.removeEventListener("visibilitychange", recordVisit); };
  }, []);
  useEffect(() => {
    if (!selected && !drawer && !policy && !success) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const dialogs = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
    const dialog = dialogs[dialogs.length - 1];
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') || []);
    focusables()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { if (policy) setPolicy(null); else if (success) setSuccess(null); else if (drawer) setDrawer(null); else setSelected(null); return; }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
  }, [selected, drawer, policy, success]);

  const filtered = useMemo(() => {
    const list = products.filter(p =>
      (mood === "all" || p.id === mood) &&
      (!query || (p.name + " " + p.mood + " " + p.sku).toLowerCase().includes(query.toLowerCase())) &&
      (!stockOnly || (p.stock_confirmed && p.stock > 0)) &&
      (priceFilter === "all" || (p.price_confirmed && (priceFilter === "under" ? p.price < 70000 : p.price >= 70000))) &&
      (!minRating || (p.rating != null && p.rating >= minRating)));
    const result = [...list];
    if (sort === "price-asc") result.sort((a, b) => (a.price_confirmed ? a.price : Infinity) - (b.price_confirmed ? b.price : Infinity));
    if (sort === "price-desc") result.sort((a, b) => (b.price_confirmed ? b.price : -1) - (a.price_confirmed ? a.price : -1));
    if (sort === "rating") result.sort((a, b) => (b.rating || -1) - (a.rating || -1));
    return result;
  }, [products, mood, query, stockOnly, priceFilter, minRating, sort]);
  const cartLines = cart.map(line => ({ ...line, product: products.find(p => p.id === line.id) })).filter(line => !!line.product) as (CartLine & {product: Product})[];
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const discount = voucher?.discount || 0;
  const total = subtotal - discount;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const canBuy = (product: Product) => !!(product.price_confirmed && product.stock_confirmed && product.stock > 0);
  const stockLabel = (product: Product) => !product.stock_confirmed ? "Chờ cập nhật tồn kho" : product.stock > 0 ? "Còn hàng" : "Hết hàng";
  const resetFilters = () => { setMood("all"); setQuery(""); setSort("featured"); setStockOnly(false); setPriceFilter("all"); setMinRating(0); };
  const toggleFavorite = (product: Product) => {
    const next = favorites.includes(product.id) ? favorites.filter(id => id !== product.id) : [...favorites, product.id];
    setFavorites(next);
    setNotice(favorites.includes(product.id) ? "Đã bỏ yêu thích." : "Đã lưu vào yêu thích trên thiết bị này.");
  };
  function add(product: Product, quantity = 1) {
    if (!canBuy(product)) { setNotice("Giá hoặc tình trạng hàng chưa được xác nhận."); return; }
    setCart(previous => {
      const current = previous.find(line => line.id === product.id)?.quantity || 0;
      return [...previous.filter(line => line.id !== product.id), { id: product.id, quantity: Math.min(product.stock, current + quantity), price: product.price }];
    });
    setVoucher(null);
    setNotice("Đã thêm " + quantity + " hộp " + product.name + " vào giỏ.");
    setDrawer("cart");
  }
  function changeQuantity(id: string, quantity: number) {
    const product = products.find(p => p.id === id);
    setCart(previous => quantity <= 0 ? previous.filter(line => line.id !== id) : previous.map(line => line.id === id ? { ...line, quantity: Math.min(product?.stock || 0, quantity) } : line));
    setVoucher(null);
    setNotice("Giỏ hàng đã được cập nhật.");
  }
  async function openDetail(product: Product, updateUrl = true) {
    if (updateUrl) history.replaceState(null, "", "/?product=" + encodeURIComponent(product.id));
    setSelected(product); setDetailQuantity(1); setDetailReviews([]);
    try { const data: any = await fetch("/api/catalog?id=" + encodeURIComponent(product.id)).then(r => r.json()); setDetailReviews(data.reviews || []); } catch {}
  }
  function closeDetail() { setSelected(null); history.replaceState(null, "", "/"); }
  async function applyVoucher() {
    try {
      const response = await fetch("/api/voucher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: voucherInput, subtotal }) });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVoucher(data); setNotice("Đã áp dụng mã ưu đãi.");
    } catch (error) { setVoucher(null); setNotice(error instanceof Error ? error.message : "Mã không hợp lệ hoặc đã hết hạn."); }
  }
  async function placeOrder(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setNotice("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...checkout, requestKey: requestKey.current, items: cart.map(({id,quantity}) => ({id,quantity})), voucherCode: voucher?.code || "" }) });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa gửi được yêu cầu.");
      setSuccess(data.order); setDrawer(null); setCart([]); setVoucher(null); requestKey.current = "";
    } catch (error) { setNotice(error instanceof Error ? error.message : "Chưa gửi được yêu cầu. Vui lòng thử lại hoặc liên hệ Form V."); }
    finally { setSubmitting(false); }
  }
  async function track(event: FormEvent) {
    event.preventDefault(); setTracked(null);
    try {
      const response = await fetch("/api/orders?code=" + encodeURIComponent(trackCode) + "&phone=" + encodeURIComponent(trackPhone));
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTracked(data.order);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không tìm thấy yêu cầu đặt hàng."); }
  }
  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (reviewSubmitting) return;
    setReviewError(""); setReviewFeedback("");
    if (reviewDraft.source === "website_order") {
      const phone = reviewDraft.phone.replace(/[\s.-]/g, "");
      if (!/^(0|\+84)\d{9,10}$/.test(phone)) { setReviewError("Vui lòng nhập đầy đủ số điện thoại đã dùng khi đặt hàng (10–11 chữ số)."); return; }
      if (!/^DA-[A-Z0-9]+-[A-Z0-9]{5}$/i.test(reviewDraft.code.trim())) { setReviewError("Mã đơn cần là mã DA-… được cấp sau khi gửi yêu cầu đặt hàng. Hãy dùng mục Tra cứu đơn hàng để kiểm tra mã."); return; }
    }
    setReviewSubmitting(true);
    try {
      if (!reviewRequestKey.current) reviewRequestKey.current = crypto.randomUUID();
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...reviewDraft, requestKey: reviewRequestKey.current }) });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReviewFeedback("Đã nhận đánh giá. Đánh giá sẽ xuất hiện sau khi Admin duyệt."); setReviewDraft(blankReview); reviewRequestKey.current = "";
    } catch (error) { setReviewError(error instanceof Error ? error.message : "Chưa gửi được đánh giá. Bạn thử lại nhé."); }
    finally { setReviewSubmitting(false); }
  }

  return <div className="site-shell">
    <div className="announcement"><Sparkles size={14}/> DÁN ĐÚNG MOOD, DIỆN ĐÚNG MỐT <span>✦</span> 5 THIẾT KẾ ĐỂ LÀ CHÍNH MÌNH</div>
    <header className="store-header">
      <a href="#home" className="brand"><img src="/form-v-logo.jpg" alt="Form V" width="2172" height="724"/></a>
      <nav className={mobileMenu ? "nav-open" : ""} aria-label="Điều hướng chính">
        <a href="#home" onClick={() => setMobileMenu(false)}>Trang chủ</a>
        <a href="#shop" onClick={() => setMobileMenu(false)}>Cửa hàng</a>
        <a href="#collection" onClick={() => setMobileMenu(false)}>Bộ sưu tập</a>
        <a href="#offers" onClick={() => setMobileMenu(false)}>Combo & ưu đãi</a>
        <a href="#story" onClick={() => setMobileMenu(false)}>Về DermaAngel</a>
        <a href="#contact" onClick={() => setMobileMenu(false)}>Liên hệ</a>
      </nav>
      <div className="header-actions">
        <button aria-label="Tìm kiếm" onClick={() => { document.getElementById("shop")?.scrollIntoView({behavior:"smooth"}); document.getElementById("shop-search")?.focus(); }}><Search size={20}/></button>
        <button aria-label={"Giỏ hàng " + cartCount + " sản phẩm"} onClick={() => setDrawer("cart")} className="cart-trigger"><ShoppingBag size={20}/>{cartCount > 0 && <b>{cartCount}</b>}</button>
        <button className="mobile-toggle" aria-label={mobileMenu ? "Đóng menu" : "Mở menu"} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={22}/> : <Menu size={22}/>}</button>
      </div>
    </header>

    <main id="home">
      <section className="hero">
        <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line"/> MOOD IN THE CLOUDS <span className="eyebrow-star">✦</span></div>
            <h1>Dán đúng <em>Mood,</em><br/>Diện đúng <em>Mốt.</em></h1>
            <p>Miếng dán mụn DermaAngel — 5 thiết kế, 5 cách thể hiện cá tính. Chăm sóc bản thân theo cách mình yêu thích.</p>
            <div className="hero-buttons"><a className="button button-primary" href="#collection">Khám phá bộ sưu tập <ArrowRight size={17}/></a><a className="button button-light" href="#mood">Chọn mood của bạn</a></div>
            <div className="hero-foot"><span><i/> 5 thiết kế</span></div>
          </div>
          <div className="hero-visual"><div className="hero-ring"/><img src="/products-hero.png" alt="Năm bao bì gốc DermaAngel: Glitter, Panda, Cute Paws, Hologram và Kitties" width="1383" height="922" fetchPriority="high"/><span className="hero-sticker">your skin<br/><b>your mood</b><small>✧</small></span></div>
        </div>
        <div className="cloud-floor"/><div className="hero-bottom-text">OWN YOUR MOOD ✦ OWN YOUR STYLE ✦ OWN YOUR MOOD ✦ OWN YOUR STYLE</div>
      </section>
      <section className="promise-row container" aria-label="Điểm nổi bật"><div><span>01</span><b>Chọn thiết kế hợp gu</b><small>5 mood, 5 cách thể hiện</small></div><div><span>02</span><b>Ảnh bao bì gốc</b><small>Đúng từng thiết kế DermaAngel</small></div><div><span>03</span><b>Thông tin rõ ràng</b><small>Giá và tồn kho cần được xác nhận</small></div></section>

      <section className="section collection-section" id="shop"><div className="container" id="collection">
        <div className="section-heading"><div><span className="kicker">THE COLLECTION ✦</span><h2>Chọn một <em>mood</em> cho hôm nay</h2><p>Mỗi thiết kế là một nét cá tính. Bạn thích phiên bản nào?</p></div><div className="section-deco">✳</div></div>
        <div className="shop-tools">
          <div className="mood-tabs" role="group" aria-label="Lọc thiết kế">{[["all","Tất cả"], ...products.map(p => [p.id,p.name])].map(([id,name]) => <button key={id} className={mood === id ? "active" : ""} onClick={() => setMood(id)}>{name}</button>)}</div>
          <div className="filter-row">
            <label className="search-field"><Search size={17}/><input id="shop-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm thiết kế…" aria-label="Tìm sản phẩm"/></label>
            <label className="sort-field"><SlidersHorizontal size={16}/><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sắp xếp sản phẩm"><option value="featured">Nổi bật</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="rating">Đánh giá cao nhất</option></select><ChevronDown size={14}/></label>
            <label className="stock-filter"><input type="checkbox" checked={stockOnly} onChange={event => setStockOnly(event.target.checked)}/> Còn hàng</label>
            <select className="extra-filter" value={priceFilter} onChange={event => setPriceFilter(event.target.value)} aria-label="Lọc theo giá"><option value="all">Mọi mức giá</option><option value="under">Dưới 70.000 đ</option><option value="over">Từ 70.000 đ</option></select>
            <select className="extra-filter" value={minRating} onChange={event => setMinRating(Number(event.target.value))} aria-label="Lọc theo đánh giá"><option value="0">Mọi đánh giá</option><option value="5">Từ 5 sao</option><option value="3">Từ 3 sao</option></select>
          </div>
        </div>
        {loading ? <div className="loading-grid">{[1,2,3,4,5].map(n => <div key={n} className="skeleton-card"/>)}</div> : loadError ? <div className="empty-state">{loadError}<button onClick={refreshCatalog}>Thử lại</button></div> : filtered.length ? <div className="product-grid">{filtered.map((p,index) => <article className={"product-card tone-" + p.id} key={p.id}>
          <div className="card-top"><span className="card-index">0{index+1} / 05</span><button aria-label={favorites.includes(p.id) ? "Bỏ " + p.name + " khỏi yêu thích" : "Lưu " + p.name + " vào yêu thích"} onClick={() => toggleFavorite(p)} className={"card-heart " + (favorites.includes(p.id) ? "is-favorite" : "")}><Heart size={18} fill={favorites.includes(p.id) ? "currentColor" : "none"}/></button></div>
          <button className="card-art-button" onClick={() => openDetail(p)} aria-label={"Xem chi tiết " + p.name}><ProductArt product={p}/></button>
          <div className="card-info"><span className="card-mood">{p.mood} mood</span><h3>Acne Beauty Patch <strong>{p.name}</strong></h3><div className="card-rating"><Star size={14} fill={p.rating ? "currentColor" : "none"}/>{p.rating ? p.rating + "/5 (" + p.review_count + " đánh giá)" : "Chưa có đánh giá"}<span>·</span>{p.sold ? "Đã bán " + p.sold : "Chưa có lượt mua"}</div><div className="card-price-row"><b>{p.price_confirmed ? money(p.price) : "Giá chờ xác nhận"}</b><span className={p.stock_confirmed && p.stock ? "in-stock" : "out-stock"}>{stockLabel(p)}</span></div><div className="card-buttons"><button className="button card-detail" onClick={() => openDetail(p)}>Xem chi tiết</button>{canBuy(p) ? <button className="button card-add" onClick={() => add(p)}><ShoppingBag size={16}/> Thêm giỏ</button> : <button className="button card-add" onClick={() => document.getElementById("contact")?.scrollIntoView({behavior:"smooth"})}>Hỏi tình trạng hàng</button>}</div></div>
        </article>)}</div> : <div className="empty-state">Chưa tìm thấy thiết kế phù hợp. Bạn thử đổi từ khóa hoặc bộ lọc nhé. <button onClick={resetFilters}>Xóa bộ lọc</button></div>}
      </div></section>

      <section className="mood-section section" id="mood"><div className="container mood-layout"><div><span className="kicker">FIND YOUR KIND OF MAGIC</span><h2>Hôm nay bạn là <em>mood</em> nào?</h2><p>Không có một kiểu chăm sóc bản thân cho tất cả mọi người. Hãy chọn thiết kế khiến bạn mỉm cười.</p><div className="mood-pills">{products.map(p => <button key={p.id} onClick={() => setMood(p.id)} className={mood === p.id ? "selected" : ""}>✦ {p.name}</button>)}</div></div><div className="mood-feature"><span className="floating-star">✧</span><div className="mood-feature-art">{products.length > 0 && <ProductArt product={products.find(p => p.id === (mood === "all" ? "hologram" : mood)) || products[0]} large/>}</div><div><small>YOUR CURRENT MOOD</small><h3>{products.find(p => p.id === mood)?.name || "Hologram"}</h3><p>{moodCopy[mood === "all" ? "hologram" : mood]}</p><button className="button button-light" onClick={() => { const product = products.find(p => p.id === (mood === "all" ? "hologram" : mood)); if (product) void openDetail(product); }}>Xem thiết kế này</button></div></div></div></section>
      <section className="section offers-section" id="offers"><div className="container offers-layout"><div className="offers-mark">✳</div><div><span className="kicker">COMBO & SPECIAL OFFERS</span><h2>Chọn mood bạn thích, <em>khám phá ưu đãi phù hợp</em></h2>{offers.length ? <><p>Ưu đãi đang áp dụng theo điều kiện và thời hạn đã cấu hình:</p><div className="offer-list">{offers.map(offer => <div key={offer.code}><b>{offer.code}</b><span>{offer.kind === "percent" ? "Giảm " + offer.amount + "%" : "Giảm " + money(offer.amount)} · Đơn từ {money(offer.min_subtotal)}{offer.ends_at ? " · Đến " + new Date(offer.ends_at).toLocaleDateString("vi-VN") : ""}</span></div>)}</div></> : <><p>Hiện chưa có chương trình ưu đãi. Bạn vẫn có thể khám phá 5 thiết kế và chọn mẫu mình yêu thích.</p><span className="waiting-badge">Chưa có ưu đãi đang hoạt động</span></>}<a className="button button-light offer-cta" href="#collection">Xem bộ sưu tập</a></div><div className="offers-aside"><span>MOOD IN THE CLOUDS</span><b>5 moods.<br/>One little cloud.</b><div className="doodle">♡ ✦ ☁</div></div></div></section>
      <section className="section story-section" id="story"><div className="container story-layout"><div className="story-card"><span className="story-big-star">✦</span><img src="/products-hero.png" alt="Bộ sưu tập năm mẫu DermaAngel" width="1383" height="922" loading="lazy"/><span className="story-mini">Dán đúng mood<br/>diện đúng mốt</span></div><div className="story-copy"><span className="kicker">HELLO, DERMAANGEL</span><h2>Đẹp theo cách <em>mình thích.</em></h2><p>Chăm sóc bản thân là một hành trình rất riêng. DermaAngel mang đến những thiết kế để bạn có thể chọn theo gu, vui với lựa chọn ấy và tự tin thể hiện cá tính mỗi ngày.</p><p>Thông điệp của chúng mình đơn giản: Derma Angel xinh theo ý, nàng diện theo gu.</p><a href={dermaAngelPage} target="_blank" rel="noreferrer" className="text-link">Ghé Fanpage DermaAngel <ArrowRight size={17}/></a></div></div></section>

      <section className="section reviews-section" id="reviews"><div className="container">
        <div className="section-heading"><div><span className="kicker">YOUR VOICE MATTERS</span><h2>Chia sẻ trải nghiệm <em>của bạn</em></h2><p>Trải nghiệm thực tế của bạn giúp chúng mình phục vụ tốt hơn.</p></div></div>
        <div className="reviews-layout">
          <div className="reviews-summary">
            <strong>{rating.count ? Number(rating.average).toFixed(1).replace(".", ",") + "/5" : "Chưa có đánh giá"}</strong>
            <span>{rating.count ? "Từ " + rating.count + " đánh giá đã duyệt" : "Hãy là người đầu tiên chia sẻ trải nghiệm."}</span>
            <div className="review-cards">{reviews.map(review => <article key={review.id}><span>{"★".repeat(review.rating)}</span><b>{review.display_name} · {review.product_name}</b><small>{new Date(review.created_at).toLocaleDateString("vi-VN")} · {review.source === "direct" ? "Khách gửi trực tiếp" : "Đã đối chiếu đơn website"}</small>{review.body && <p>{review.body}</p>}</article>)}</div>
          </div>
          <form className="public-review-form" onSubmit={submitReview}>
            <h3>Viết đánh giá</h3><p>Chia sẻ trải nghiệm với thiết kế bạn đã dùng. Đánh giá được Admin duyệt trước khi hiển thị.</p>
            <fieldset className="review-source"><legend>Hình thức mua</legend><label><input type="radio" name="review-source" checked={reviewDraft.source === "direct"} onChange={() => {setReviewDraft({...reviewDraft,source:"direct"});setReviewError("");}}/> Mua trực tiếp hoặc qua kênh khác</label><label><input type="radio" name="review-source" checked={reviewDraft.source === "website_order"} onChange={() => {setReviewDraft({...reviewDraft,source:"website_order"});setReviewError("");}}/> Đặt qua website</label></fieldset>
            {reviewDraft.source === "website_order" && <><p className="review-hint">Dùng mã đơn website cấp và số điện thoại đã đặt hàng. Đơn cần được xác nhận thanh toán và giao xong.</p><label>Mã đơn hàng *<input required value={reviewDraft.code} onChange={event => setReviewDraft({...reviewDraft,code:event.target.value})} placeholder="Ví dụ: DA-MW7KDQH8-DB38A"/></label><label>Số điện thoại đặt hàng *<input required inputMode="tel" value={reviewDraft.phone} onChange={event => setReviewDraft({...reviewDraft,phone:event.target.value})} placeholder="Nhập đủ 10–11 chữ số"/></label></>}
            <label>Tên hiển thị *<input required maxLength={80} value={reviewDraft.displayName} onChange={event => setReviewDraft({...reviewDraft,displayName:event.target.value})}/></label>
            <label>Thiết kế đã dùng *<select required value={reviewDraft.productId} onChange={event => setReviewDraft({...reviewDraft,productId:event.target.value})}><option value="">Chọn thiết kế</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <fieldset className="review-stars"><legend>Điểm đánh giá *</legend>{[1,2,3,4,5].map(stars => <label key={stars}><input type="radio" name="review-rating" required value={stars} checked={reviewDraft.rating === stars} onChange={() => setReviewDraft({...reviewDraft,rating:stars})}/>{stars} sao</label>)}</fieldset>
            <label>Nội dung đánh giá (không bắt buộc)<textarea maxLength={1000} value={reviewDraft.body} onChange={event => setReviewDraft({...reviewDraft,body:event.target.value})} placeholder="Chia sẻ trải nghiệm của bạn…"/></label>
            <label className="check-label"><input type="checkbox" required checked={reviewDraft.consentPublic} onChange={event => setReviewDraft({...reviewDraft,consentPublic:event.target.checked})}/> Tôi đồng ý công khai tên hiển thị, điểm và nội dung đánh giá trên website.</label>
            {reviewError && <p className="review-feedback error" role="alert">{reviewError}</p>}
            {reviewFeedback && <p className="review-feedback success" role="status">{reviewFeedback}</p>}
            <button className="button button-primary" disabled={reviewSubmitting}>{reviewSubmitting ? "Đang gửi…" : "Gửi đánh giá"}</button>
          </form>
        </div>
      </div></section>

      <section className="section faq-section" id="faq"><div className="container"><div className="section-heading"><div><span className="kicker">HELPFUL ANSWERS</span><h2>Câu hỏi <em>thường gặp</em></h2></div></div><div className="faq-list">
        <details><summary>Có những thiết kế nào?</summary><p>Bộ sưu tập gồm Glitter, Panda, Cute Paws, Hologram và Kitties.</p></details>
        <details><summary>Mình chọn thiết kế theo mood như thế nào?</summary><p>Chọn một thiết kế trong mục “Hôm nay bạn là mood nào?” để xem gợi ý. Bạn có thể chọn theo sở thích của mình.</p></details>
        <details><summary>Làm sao để đặt hàng và nhận trực tiếp?</summary><p>Thêm sản phẩm vào giỏ, chọn nhận tại điểm bán Form V và gửi thông tin khi hình thức này được mở. Giữ mã yêu cầu để đối chiếu khi đội xác nhận và khi nhận hàng.</p></details>
        <details><summary>Dùng sản phẩm như thế nào?</summary><p>Vui lòng đọc hướng dẫn trên bao bì và thông tin chính thức trong phần chi tiết sản phẩm trước khi sử dụng.</p></details>
        <details><summary>Có được đổi trả không?</summary><p>Vui lòng xem Chính sách mua hàng hoặc liên hệ Form V để được hướng dẫn theo tình trạng đơn hàng.</p></details>
      </div></div></section>

      <section className="social-section" id="contact"><div className="container social-layout"><div><span className="kicker">CONNECT WITH FORM V</span><h2>Kết nối cùng <em>Form V</em></h2><p>Bạn cần hỏi về thiết kế, tình trạng hàng hoặc cách nhận hàng? Nhắn cho chúng mình nhé.</p><p>Fanpage <a href={formVPage} target="_blank" rel="noreferrer">Form V</a>: cập nhật và hỗ trợ khách hàng.</p><p>Fanpage <a href={dermaAngelPage} target="_blank" rel="noreferrer">DermaAngel</a>: thông tin thương hiệu.</p><p><b>Email:</b> <a href="mailto:dermaangelfromv@gmail.com">dermaangelfromv@gmail.com</a><br/><b>Hotline:</b> <a href="tel:+84835755880">083 575 5880</a><br/><b>Điểm bán:</b> Trường Đại học Ngân hàng<br/><b>Thời gian hoạt động:</b> 9:00 - 16:00</p></div><div className="social-actions"><a className="button button-primary" href={formVPage} target="_blank" rel="noreferrer">Fanpage Form V <ArrowRight size={17}/></a><a className="button button-light" href={dermaAngelPage} target="_blank" rel="noreferrer">Fanpage DermaAngel</a><a className="button button-light" href="mailto:dermaangelfromv@gmail.com">Email Form V</a></div></div></section>
    </main>

    <footer className="footer"><div className="container footer-grid"><div><img src="/dermaangel-logo.png" alt="DermaAngel" width="1086" height="362"/><p>Dán đúng Mood, Diện đúng Mốt.</p></div><div><b>Khám phá</b><a href="#collection">Bộ sưu tập</a><a href="#mood">Chọn mood</a><a href="#reviews">Đánh giá</a></div><div><b>Hỗ trợ</b><button onClick={() => setDrawer("track")}>Tra cứu đơn hàng</button><button onClick={() => setPolicy("purchase")}>Chính sách mua hàng</button><button onClick={() => setPolicy("privacy")}>Thông tin bảo mật</button></div><div><b>Kết nối</b><a href={formVPage} target="_blank" rel="noreferrer">Fanpage Form V</a><a href={dermaAngelPage} target="_blank" rel="noreferrer">Fanpage DermaAngel</a><a href="mailto:dermaangelfromv@gmail.com">Email: dermaangelfromv@gmail.com</a><a href="tel:+84835755880">Hotline: 083 575 5880</a><span>Điểm bán: Trường Đại học Ngân hàng</span><span>Thời gian hoạt động: 9:00 - 16:00</span><a href="#home">Về đầu trang ↑</a></div></div><div className="container footer-bottom"><span>© 2026 DermaAngel · Form V.</span><span>Made for every mood ✦</span></div></footer>

    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Đóng thông báo"><X size={16}/></button></div>}

    {selected && <div className="modal-backdrop" onMouseDown={closeDetail}><div className="detail-modal" role="dialog" aria-modal="true" aria-label={"Chi tiết " + selected.name} onMouseDown={event => event.stopPropagation()}><button className="close" onClick={closeDetail} aria-label="Đóng"><X/></button><div className={"detail-art tone-" + selected.id}><ProductArt product={selected} large/><small>Ảnh bao bì gốc</small></div><div className="detail-content"><span className="kicker">DERMAANGEL / {selected.sku}</span><h2>DermaAngel Acne Beauty Patch <em>{selected.name}</em></h2><p className="detail-price">{selected.price_confirmed ? money(selected.price) + "/hộp" : "Giá chờ xác nhận"}</p><div className="detail-meta"><span><Star size={16}/>{selected.rating ? selected.rating + "/5 · " + selected.review_count + " đánh giá" : "Chưa có đánh giá"}</span><span>{stockLabel(selected)}</span></div><p>{selected.description}</p><div className="detail-note"><b>Thiết kế</b><span>{selected.mood}</span></div><div className="detail-note"><b>Quy cách và thông tin sản phẩm</b><span>Vui lòng đối chiếu thông tin chính thức trên bao bì trước khi sử dụng.</span></div><div className="detail-note"><b>Hướng dẫn sử dụng và lưu ý</b><span>Đội đang chờ tài liệu sản phẩm được xác nhận. Vui lòng đọc hướng dẫn và lưu ý trên bao bì.</span></div><div className="detail-buy"><div className="quantity-stepper"><button onClick={() => setDetailQuantity(Math.max(1,detailQuantity-1))} aria-label="Giảm số lượng"><Minus size={16}/></button><span>{detailQuantity}</span><button onClick={() => setDetailQuantity(Math.min(selected.stock,detailQuantity+1))} aria-label="Tăng số lượng" disabled={!canBuy(selected)}><Plus size={16}/></button></div>{canBuy(selected) ? <button className="button button-primary" onClick={() => { add(selected,detailQuantity); closeDetail(); }}>Thêm vào giỏ <ShoppingBag size={17}/></button> : <button className="button button-light" onClick={() => { closeDetail(); document.getElementById("contact")?.scrollIntoView({behavior:"smooth"}); }}>Hỏi tình trạng hàng</button>}</div><div className="detail-reviews"><b>Đánh giá đã duyệt</b>{detailReviews.length ? detailReviews.map(review => <div key={review.id}><span>{"★".repeat(review.rating)} · {review.display_name} · {review.source === "direct" ? "Khách gửi trực tiếp" : "Đã đối chiếu đơn website"}</span>{review.body && <p>{review.body}</p>}</div>) : <p>Chưa có đánh giá.</p>}</div></div></div></div>}

    {drawer && <div className="drawer-backdrop" onMouseDown={() => setDrawer(null)}><aside className="drawer" role="dialog" aria-modal="true" aria-label={drawer === "cart" ? "Giỏ hàng" : drawer === "checkout" ? "Đặt hàng" : "Tra cứu đơn hàng"} onMouseDown={event => event.stopPropagation()}><div className="drawer-head"><div><small>DERMAANGEL</small><h2>{drawer === "cart" ? "Giỏ hàng của bạn" : drawer === "checkout" ? "Hoàn tất thông tin đặt hàng" : "Tra cứu đơn hàng"}</h2></div><button onClick={() => setDrawer(null)} aria-label="Đóng"><X/></button></div>
      {drawer === "cart" && <div className="drawer-body">{cartLines.length ? <><div className="cart-lines">{cartLines.map(line => <div className="cart-line" key={line.id}><ProductArt product={line.product}/><div><b>{line.product.name}</b><small>{line.product.price_confirmed ? money(line.product.price) + " / hộp" : "Giá chờ xác nhận"}</small>{line.price !== undefined && line.price !== line.product.price && <small>Giá đã thay đổi. Vui lòng kiểm tra lại.</small>}<div className="quantity-stepper"><button onClick={() => changeQuantity(line.id,line.quantity-1)} aria-label={"Giảm " + line.product.name}><Minus size={14}/></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.id,line.quantity+1)} disabled={line.quantity >= line.product.stock} aria-label={"Tăng " + line.product.name}><Plus size={14}/></button></div></div><button onClick={() => changeQuantity(line.id,0)} aria-label={"Xóa " + line.product.name}><X size={16}/></button></div>)}</div>{offers.length > 0 && <div className="voucher-row"><input value={voucherInput} onChange={event => setVoucherInput(event.target.value)} placeholder="Nhập mã ưu đãi" aria-label="Mã ưu đãi"/><button onClick={applyVoucher} disabled={!voucherInput}>Áp dụng</button></div>}<div className="totals"><div><span>Tạm tính</span><b>{money(subtotal)}</b></div><div><span>Giảm giá</span><b>−{money(discount)}</b></div><div><span>Phí giao hàng</span><b>Chờ xác nhận</b></div><div className="grand-total"><span>Tổng dự kiến</span><b>{money(total)}</b></div><small>Tổng tiền cuối cùng được xác nhận cùng hình thức nhận hàng trước khi bạn thanh toán.</small></div>{settings.pickup_enabled || settings.delivery_enabled ? <button className="button button-primary full" disabled={cartLines.some(line => !canBuy(line.product))} onClick={() => setDrawer("checkout")}>Tiến hành đặt hàng <ArrowRight size={17}/></button> : <p className="checkout-intro">Form V chưa mở hình thức nhận hàng. Vui lòng liên hệ để hỏi tình trạng hàng.</p>}<button className="back-link" onClick={() => { setDrawer(null); document.getElementById("collection")?.scrollIntoView({behavior:"smooth"}); }}>Tiếp tục chọn mood</button></> : <div className="drawer-empty"><ShoppingBag size={46}/><h3>Giỏ hàng đang trống</h3><p>Chọn một mood để bắt đầu nhé!</p><button className="button button-primary" onClick={() => {setDrawer(null);document.getElementById("collection")?.scrollIntoView({behavior:"smooth"});}}>Khám phá bộ sưu tập</button></div>}</div>}
      {drawer === "checkout" && <form className="drawer-body checkout-form" onSubmit={placeOrder}><p className="checkout-intro">Để lại thông tin để Form V xác nhận đơn và cách nhận hàng cùng bạn.</p><label>Họ và tên *<input required value={checkout.customerName} onChange={event => setCheckout({...checkout,customerName:event.target.value})} placeholder="Nhập họ và tên"/></label><label>Số điện thoại *<input required inputMode="tel" value={checkout.phone} onChange={event => setCheckout({...checkout,phone:event.target.value})} placeholder="Nhập số điện thoại"/></label><label>Email (không bắt buộc)<input type="email" value={checkout.email} onChange={event => setCheckout({...checkout,email:event.target.value})}/></label><label>Hình thức nhận hàng *<select required value={checkout.receiveMethod} onChange={event => setCheckout({...checkout,receiveMethod:event.target.value})}><option value="">Chọn hình thức</option>{!!settings.pickup_enabled && <option value="pickup">Nhận tại điểm bán Form V</option>}{!!settings.delivery_enabled && <option value="delivery">Giao hàng</option>}</select></label>{checkout.receiveMethod === "pickup" && <p className="checkout-intro"><b>Điểm nhận hàng:</b> {settings.pickup_location}</p>}{checkout.receiveMethod === "delivery" && <><label>Địa chỉ nhận hàng *<input required value={checkout.address} onChange={event => setCheckout({...checkout,address:event.target.value})}/></label><label>Tỉnh hoặc thành phố *<input required value={checkout.province} onChange={event => setCheckout({...checkout,province:event.target.value})}/></label><label>Phường hoặc xã *<input required value={checkout.ward} onChange={event => setCheckout({...checkout,ward:event.target.value})}/></label><label>Thông tin địa chỉ bổ sung<input value={checkout.district} onChange={event => setCheckout({...checkout,district:event.target.value})}/></label></>}<label>Ghi chú (không bắt buộc)<textarea value={checkout.note} onChange={event => setCheckout({...checkout,note:event.target.value})}/></label><div className="totals"><div><span>Đơn hàng của bạn · {cartCount} hộp</span><b>{money(subtotal)}</b></div><div><span>Giảm giá</span><b>−{money(discount)}</b></div><div className="grand-total"><span>Tổng dự kiến</span><b>{money(total)}</b></div><small>Hình thức thanh toán sẽ được Form V xác nhận. Yêu cầu đặt hàng chưa phải xác nhận thanh toán.</small></div><label className="check-label"><input type="checkbox" required checked={checkout.orderConsent} onChange={event => setCheckout({...checkout,orderConsent:event.target.checked})}/> Tôi đồng ý để Form V sử dụng thông tin đã cung cấp nhằm xác nhận và xử lý đơn hàng theo Thông tin bảo mật.</label><button type="button" className="back-link" onClick={() => setPolicy("privacy")}>Đọc Thông tin bảo mật</button><button className="button button-primary full" disabled={submitting || !cartLines.length || !checkout.orderConsent}>{submitting ? "Đang gửi yêu cầu…" : "Gửi yêu cầu đặt hàng"}</button><button type="button" className="back-link" onClick={() => setDrawer("cart")}>← Quay lại giỏ hàng</button></form>}
      {drawer === "track" && <div className="drawer-body"><p className="checkout-intro">Nhập mã đơn và số điện thoại đã dùng khi gửi yêu cầu.</p><form className="track-form" onSubmit={track}><label>Mã đơn hàng<input required value={trackCode} onChange={event => setTrackCode(event.target.value)} placeholder="DA-..."/></label><label>Số điện thoại<input required inputMode="tel" value={trackPhone} onChange={event => setTrackPhone(event.target.value)} placeholder="0..."/></label><button className="button button-primary full">Tra cứu đơn hàng</button></form>{tracked && <div className="tracked-order"><span className="status-pill">{tracked.status}</span><h3>{tracked.code}</h3><p>{tracked.customer_name} · {tracked.receive_method === "pickup" ? "Nhận tại điểm bán" : "Giao hàng"}</p><div className="totals"><div><span>Thanh toán</span><b>{tracked.payment_status}</b></div><div><span>Tổng dự kiến</span><b>{money(tracked.total)}</b></div><div><span>Phí giao</span><b>{tracked.shipping_fee == null ? "Chờ xác nhận" : money(tracked.shipping_fee)}</b></div></div>{tracked.items?.map((item:any) => <div className="tracked-item" key={item.product_id}>{item.name} × {item.quantity} <b>{money(item.price * item.quantity)}</b></div>)}{tracked.status === "delivered" && tracked.payment_status === "paid" && <button className="button button-light full" onClick={() => {setReviewDraft({...blankReview,source:"website_order",code:trackCode,phone:trackPhone,productId:tracked.items?.[0]?.product_id || ""});setDrawer(null);document.getElementById("reviews")?.scrollIntoView({behavior:"smooth"});}}>Viết đánh giá</button>}</div>}</div>}
    </aside></div>}

    {policy && <div className="modal-backdrop" onMouseDown={() => setPolicy(null)}><div className="policy-modal" role="dialog" aria-modal="true" aria-label={policy === "purchase" ? "Chính sách mua hàng" : "Thông tin bảo mật"} onMouseDown={event => event.stopPropagation()}><button className="close" onClick={() => setPolicy(null)} aria-label="Đóng"><X/></button>{policy === "purchase" ? <><h2>Chính sách mua hàng</h2><p>Form V tiếp nhận yêu cầu đặt hàng. Đội sẽ liên hệ để xác nhận sản phẩm, số lượng, tổng tiền và phương thức nhận hàng trước khi hoàn tất đơn.</p><h3>Nhận hàng</h3><p>{settings.shipping_policy || "Điểm nhận, lịch nhận, khu vực giao, thời gian và phí giao hàng đang chờ Form V xác nhận."}</p><h3>Thanh toán</h3><p>Yêu cầu gửi trên website chưa phải xác nhận thanh toán. Form V sẽ thông báo phương thức và thời điểm thanh toán sau khi kiểm tra đơn.</p><h3>Đổi trả và hủy đơn</h3><p>{settings.return_policy || "Điều kiện đổi trả và hủy đơn đang được Form V cập nhật. Vui lòng liên hệ trước khi gửi yêu cầu."}</p></> : <><h2>Thông tin bảo mật</h2><p>Form V tiếp nhận họ tên, số điện thoại và các thông tin bạn chủ động cung cấp để xác nhận đơn, hỗ trợ nhận hàng và xử lý yêu cầu liên quan.</p><p>Thông tin liên hệ của bạn không được hiển thị công khai trên website. Nếu bạn gửi đánh giá và đồng ý công khai, website hiển thị tên bạn chọn, điểm và nội dung đánh giá.</p><p>Website tự đếm tổng lượt mở trang để theo dõi hoạt động. Cơ sở dữ liệu lưu mã ngẫu nhiên cho từng lượt mở trang, thời điểm và đường dẫn; không lưu địa chỉ IP, cookie analytics hay mã nhận diện trình duyệt lâu dài. Một người tải lại trang có thể được tính thêm lượt.</p><p>{settings.privacy_contact ? "Liên hệ về dữ liệu: " + settings.privacy_contact : "Thông tin về thời gian lưu giữ, bên tiếp nhận dữ liệu và kênh yêu cầu sửa hoặc xóa đang chờ Form V công bố."}</p></>}<button className="button button-primary" onClick={() => setPolicy(null)}>Đóng</button></div></div>}

    {success && <div className="modal-backdrop"><div className="success-card" role="dialog" aria-modal="true"><div className="success-icon"><Check size={32}/></div><span className="kicker">FORM V RECEIVED YOUR REQUEST</span><h2>Form V đã nhận yêu cầu đặt hàng của bạn!</h2><p>Vui lòng giữ mã này để đối chiếu khi nhận hàng. Đội sẽ liên hệ để xác nhận sản phẩm, tổng tiền và thời gian nhận.</p><div className="success-code">Mã yêu cầu <b>{success.code}</b></div><small>Yêu cầu đặt hàng chưa phải xác nhận thanh toán.</small><button className="button button-primary full" onClick={async () => {await navigator.clipboard.writeText(success.code);setNotice("Đã sao chép mã yêu cầu.");}}>Sao chép mã</button><button className="back-link" onClick={() => setSuccess(null)}>Tiếp tục khám phá</button></div></div>}
  </div>;
}
