import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Sheet, Send, Loader2, CheckCircle2, AlertCircle, Eye, Edit3, Trash2, Image } from "lucide-react";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

const modelName = "gemini-3-flash-preview";

interface CrawledData {
  url: string;
  name: string;
  images: string[];
  description: string;
  amenities: string;
  price: string;
  rating: string;
  nearby_html: string;
  map_url: string;
  location: string;
  hotel_id: string;
  location_id: string;
  contact_name: string;
  contact_phone: string;
}

const FIXED_SHEET_URL = "https://script.google.com/macros/s/AKfycbwQXvM5cuvuNtQbp-KZryYDN-wRM3VSdqWhxyO14q2_UfsqNZbgI1iEvgcPGp9gW6XYXg/exec";

export default function App() {
  const [bookingUrl, setBookingUrl] = useState("");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [crawledData, setCrawledData] = useState<CrawledData | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [aiContent, setAiContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [step, setStep] = useState(1); // 1: Crawl, 2: AI Rewrite, 3: HTML Template, 4: Submit

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined") {
      throw new Error("API Key không khả dụng. Vui lòng kiểm tra cấu hình.");
    }
    return new GoogleGenAI({ apiKey });
  };

  const handleCrawlImages = async () => {
    if (!galleryUrl) {
      setError("Vui lòng nhập Link Gallery");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await axios.post("/api/crawl", { 
        gallery_url: galleryUrl 
      });
      const data = response.data;
      
      setCrawledData(prev => {
        const base = prev || {
          url: "", name: "", images: [], description: "", amenities: "",
          price: "", rating: "", nearby_html: "", map_url: "", location: "",
          hotel_id: "", location_id: "", contact_name: "", contact_phone: ""
        };
        return {
          ...base,
          images: data.images,
          url: base.url || data.url,
          name: base.name || data.name
        };
      });
      
      setSelectedImages(data.images?.slice(0, 5) || []);
      setSuccess("Đã quét xong ảnh từ Gallery!");
      setStep(1);
    } catch (err: any) {
      setError(err.response?.data?.error || "Đã có lỗi xảy ra khi quét ảnh.");
    } finally {
      setLoading(false);
    }
  };

  const handleCrawlContent = async () => {
    if (!bookingUrl) {
      setError("Vui lòng nhập Link Booking.com");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await axios.post("/api/crawl", { 
        booking_url: bookingUrl 
      });
      const data = response.data;
      
      setCrawledData(prev => {
        const base = prev || {
          url: "", name: "", images: [], description: "", amenities: "",
          price: "", rating: "", nearby_html: "", map_url: "", location: "",
          hotel_id: "", location_id: "", contact_name: "", contact_phone: ""
        };
        return {
          ...base,
          ...data,
          images: base.images.length > 0 ? base.images : data.images,
          nearby_html: base.nearby_html || "",
          contact_name: base.contact_name || "",
          contact_phone: base.contact_phone || ""
        };
      });
      
      setSuccess("Đã quét xong nội dung từ Booking.com!");
      setStep(1);
    } catch (err: any) {
      setError(err.response?.data?.error || "Đã có lỗi xảy ra khi quét nội dung.");
    } finally {
      setLoading(false);
    }
  };

  const handleAIRewrite = async () => {
    if (!crawledData) return;
    setAiGenerating(true);
    setError(null);
    try {
      const ai = getAi();
      const prompt = `Bạn là một biên tập viên nội dung chuyên về du lịch dành cho runner.

Dựa trên dữ liệu khách sạn dưới đây, hãy viết một đoạn mô tả ngắn gọn giúp runner đánh giá khách sạn này có phù hợp để lưu trú khi tham gia giải chạy kết hợp du lịch hay không.

## DỮ LIỆU INPUT:

* Mô tả: ${crawledData.description}
* Tiện nghi: ${crawledData.amenities}
* Khoảng giá: ${crawledData.price}
* Điểm đánh giá: ${crawledData.rating}
* Xung quanh: ${crawledData.nearby_html}

---

## YÊU CẦU VIẾT:

1. Viết bằng tiếng Việt, giọng văn trung lập, rõ ràng, giống văn phong báo chí
2. Độ dài: tùy ý, không vượt quá 15 dòng
3. KHÔNG đề cập đến khoảng cách tới điểm xuất phát hay giải chạy cụ thể

---

## TẬP TRUNG NỘI DUNG:

* Đánh giá vị trí khách sạn theo góc nhìn du lịch:
  (gần trung tâm, gần biển, thuận tiện di chuyển, khu vực sôi động hay yên tĩnh)

* Nêu rõ các giá trị khách sạn mang lại:
  (tiện nghi nổi bật, trải nghiệm nghỉ ngơi, phục hồi, thư giãn)

* Đánh giá khu vực xung quanh:
  (ăn uống, vui chơi, không gian, tiện sinh hoạt)

* Chỉ ra điểm phù hợp:
  (phù hợp với runner thích du lịch, nghỉ dưỡng, tiện nghi, tiết kiệm…)

* Có thể nêu nhẹ hạn chế nếu có (không bắt buộc)

---

## CẤU TRÚC GỢI Ý:

* Câu 1: Tổng quan vị trí & bối cảnh
* Câu 2–3: Giá trị & tiện nghi nổi bật
* Câu 4: Khu vực xung quanh
* Câu cuối: Kết luận phù hợp với nhóm runner nào

---

## OUTPUT MONG MUỐN:

Một đoạn văn duy nhất, giúp runner đọc nhanh và hiểu khách sạn này có phù hợp với nhu cầu du lịch kết hợp chạy hay không.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      
      const text = response.text;
      if (!text) throw new Error("AI không trả về kết quả.");
      
      setAiContent(text);
      setStep(2);
    } catch (err: any) {
      console.error("AI Error:", err);
      setError("Lỗi khi AI viết lại nội dung: " + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleConvertToHTML = async () => {
    if (!aiContent || !crawledData) return;
    setAiGenerating(true);
    setError(null);
    try {
      const ai = getAi();
      const prompt = `Bạn là một hệ thống chuyển đổi nội dung thành HTML theo template cố định, phục vụ hiển thị trên website.

## INPUT:

${aiContent}

---

## YÊU CẦU:

1. Giữ NGUYÊN cấu trúc HTML template bên dưới, KHÔNG được thay đổi
2. Chỉ thay nội dung vào các placeholder
3. Không thêm class, không thêm style, không thêm thuộc tính
4. Không viết thêm giải thích, chỉ trả về HTML
5. Nội dung phải ngắn gọn, rõ ràng, đúng văn phong trung lập (giống báo chí)
6. Nếu không có thông tin cho phần "Cần cân nhắc" thì vẫn giữ block nhưng để trống <ul></ul>
7. QUAN TRỌNG: Trong phần {{rating}}, CHỈ giữ lại điểm số (ví dụ: 8.5), BỎ hoàn toàn số lượng người đánh giá/vote.

---

## TEMPLATE:

\`\`\`html
<div class="hotel-card">
  <div class="hotel-summary">
    <p>{{summary}}</p>
  </div>

  <div class="hotel-pros">
    <h4>Phù hợp với runner</h4>
    <ul>
      {{pros_list}}
    </ul>
  </div>

  <div class="hotel-cons">
    <h4>Cần cân nhắc</h4>
    <ul>
      {{cons_list}}
    </ul>
  </div>

  <div class="hotel-meta">
    <span class="price">{{price}}</span>
    <span class="rating">{{rating}}</span>
  </div>
</div>
\`\`\`

---

## QUY TẮC MAP:

* {{summary}}: 1 đoạn văn tóm tắt (80–120 từ)
* {{pros_list}}: mỗi ý là 1 <li>
* {{cons_list}}: mỗi ý là 1 <li>
* {{price}}: ${crawledData.price}
* {{rating}}: ${crawledData.rating} (Lưu ý: Chỉ lấy điểm số, bỏ số lượng vote)

---

## OUTPUT MONG MUỐN:

Chỉ trả về HTML hoàn chỉnh, không có bất kỳ nội dung nào khác.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      
      const text = response.text;
      if (!text) throw new Error("AI không trả về kết quả.");
      
      // Clean up markdown code blocks if AI includes them
      let cleanedHtml = text.replace(/```html/g, "").replace(/```/g, "").trim();
      
      setHtmlContent(cleanedHtml);
      setStep(3);
    } catch (err: any) {
      console.error("AI HTML Error:", err);
      setError("Lỗi khi AI chuyển đổi HTML: " + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleImage = (url: string) => {
    setSelectedImages(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const handleSubmitToSheet = async () => {
    if (!crawledData || !htmlContent) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("Đang gửi dữ liệu đến:", FIXED_SHEET_URL);
      
      // Updated 11-column structure: hotel_id, url, name, gallery_html, description_html, map_url, location, location_id, contact_name, contact_phone, update_time
      const payload = JSON.stringify({
        hotel_id: crawledData.hotel_id,
        url: crawledData.url,
        name: crawledData.name,
        gallery_html: selectedImages.join(", "),
        description_html: htmlContent,
        map_url: crawledData.map_url,
        location: crawledData.location,
        location_id: crawledData.location_id,
        contact_name: crawledData.contact_name,
        contact_phone: crawledData.contact_phone,
        update_time: new Date().toLocaleString("vi-VN")
      });

      await fetch(FIXED_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: payload,
      });
      
      setSuccess("Dữ liệu đã được lưu thành công vào Google Sheet!");
      setBookingUrl("");
      setGalleryUrl("");
      setCrawledData(null);
      setSelectedImages([]);
      setAiContent("");
      setHtmlContent("");
      setStep(1);
    } catch (err: any) {
      console.error("Lỗi gửi dữ liệu:", err);
      setError("Không thể kết nối với Google Script. Hãy kiểm tra lại link Web App.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof CrawledData, value: string) => {
    if (crawledData) {
      setCrawledData({ ...crawledData, [field]: value });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-slate-900 mb-2"
          >
            Booking Hotel Crawler
          </motion.h1>
          <p className="text-slate-500">Crawl dữ liệu khách sạn và lưu vào Google Sheets tự động.</p>
        </header>

        {/* Image Preview Modal */}
        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setPreviewImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={previewImage} 
                  alt="Preview" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                >
                  <Trash2 size={20} className="rotate-45" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-8 mb-8">
          {/* Step 1: Images */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-2xl shadow-xl border-2 p-6 transition-all ${
              crawledData?.images && crawledData.images.length > 0 ? "border-green-100" : "border-blue-100"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  crawledData?.images && crawledData.images.length > 0 ? "bg-green-500 text-white" : "bg-blue-600 text-white"
                }`}>
                  {crawledData?.images && crawledData.images.length > 0 ? <CheckCircle2 size={20} /> : "1"}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Image size={20} className="text-blue-600" /> BƯỚC 1: QUÉT TOÀN BỘ ẢNH
                  </h3>
                  <p className="text-sm text-slate-500">Dán link Gallery để lấy ảnh chất lượng cao nhất</p>
                </div>
              </div>
              {crawledData?.images && crawledData.images.length > 0 && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  Đã có {crawledData.images.length} ảnh
                </span>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="url"
                placeholder="Dán link gallery (ví dụ: https://www.booking.com/hotel/vn/...) "
                className="flex-grow px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                value={galleryUrl}
                onChange={(e) => setGalleryUrl(e.target.value)}
              />
              <button
                onClick={handleCrawlImages}
                disabled={loading || !galleryUrl}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-blue-100"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Image size={20} />}
                Bắt đầu quét ảnh
              </button>
            </div>
          </motion.div>

          {/* Step 2: Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-white rounded-2xl shadow-xl border-2 p-6 transition-all ${
              crawledData?.description ? "border-green-100" : "border-slate-100"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  crawledData?.description ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  {crawledData?.description ? <CheckCircle2 size={20} /> : "2"}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Search size={20} className="text-green-600" /> BƯỚC 2: QUÉT NỘI DUNG (MÔ TẢ)
                  </h3>
                  <p className="text-sm text-slate-500">Dán link Booking.com để lấy thông tin chi tiết</p>
                </div>
              </div>
              {crawledData?.description && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  Đã có nội dung
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="url"
                placeholder="https://www.booking.com/hotel/vn/..."
                className="flex-grow px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
              />
              <button
                onClick={handleCrawlContent}
                disabled={loading || !bookingUrl}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-green-100"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                Bắt đầu quét nội dung
              </button>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-8 flex items-center gap-3"
            >
              <AlertCircle className="shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl mb-8 flex items-center gap-3"
            >
              <CheckCircle2 className="shrink-0" />
              <p>{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {crawledData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 mb-12"
          >
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-4 mb-8">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                    step === s ? "bg-blue-600 text-white scale-110 shadow-lg" : 
                    step > s ? "bg-green-500 text-white" : "bg-slate-200 text-slate-400"
                  }`}>
                    {step > s ? <CheckCircle2 size={16} /> : s}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${step === s ? "text-blue-600" : "text-slate-400"}`}>
                    {s === 1 ? "Quét dữ liệu" : s === 2 ? "Viết nội dung" : s === 3 ? "Tạo HTML" : "Hoàn tất"}
                  </span>
                  {s < 4 && <div className="w-8 h-px bg-slate-200" />}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg mb-1">{crawledData.name}</h3>
                  <p className="text-sm text-slate-500 truncate max-w-md">{crawledData.url}</p>
                </div>
                <button 
                  onClick={() => setCrawledData(null)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {step === 1 && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          Chọn ảnh ({selectedImages.length}/{crawledData.images.length})
                        </h4>
                        <button 
                          onClick={() => setSelectedImages(selectedImages.length === crawledData.images.length ? [] : [...crawledData.images])}
                          className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                        >
                          {selectedImages.length === crawledData.images.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto p-3 border border-slate-100 rounded-xl bg-slate-50/30">
                        {crawledData.images.map((img, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => toggleImage(img)}
                            className={`relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
                              selectedImages.includes(img) ? "border-blue-500 ring-2 ring-blue-200 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(img);
                              }}
                              className="absolute bottom-2 left-2 bg-white/90 text-slate-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                            >
                              <Eye size={14} />
                            </button>
                            {selectedImages.includes(img) && (
                              <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg">
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-emerald-600">Tên người liên hệ</label>
                        <input
                          type="text"
                          placeholder="Nguyễn Văn A..."
                          className="w-full px-4 py-2 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900"
                          value={crawledData.contact_name}
                          onChange={(e) => updateField("contact_name", e.target.value)}
                        />
                      </div>
                      <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-rose-600">Số điện thoại liên hệ</label>
                        <input
                          type="tel"
                          placeholder="090..."
                          className="w-full px-4 py-2 rounded-lg border border-rose-200 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-900"
                          value={crawledData.contact_phone}
                          onChange={(e) => updateField("contact_phone", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-purple-600">Gần với khu vực nổi tiếng nào</label>
                        <input
                          type="text"
                          placeholder="Gần biển, Cầu Rồng..."
                          className="w-full px-4 py-2 rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-900"
                          value={crawledData.nearby_html}
                          onChange={(e) => updateField("nearby_html", e.target.value)}
                        />
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-blue-600">Giá tiền (VND)</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900"
                          value={crawledData.price}
                          onChange={(e) => updateField("price", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-orange-600">Link Google Maps</label>
                        <input
                          type="text"
                          placeholder="https://www.google.com/maps/..."
                          className="w-full px-4 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm text-orange-900"
                          value={crawledData.map_url}
                          onChange={(e) => updateField("map_url", e.target.value)}
                        />
                      </div>
                      <div className="bg-green-50 p-4 rounded-xl border border-green-100 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-green-600">Tỉnh/Thành phố</label>
                        <input
                          type="text"
                          readOnly
                          className="w-full px-4 py-2 rounded-lg border border-green-200 bg-green-100/50 cursor-not-allowed outline-none font-bold text-green-900"
                          value={crawledData.location}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Hotel ID (Chỉ xem)</label>
                        <input
                          type="text"
                          readOnly
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-100/50 cursor-not-allowed outline-none text-sm text-slate-900"
                          value={crawledData.hotel_id}
                        />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Location ID (Chỉ xem)</label>
                        <input
                          type="text"
                          readOnly
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-100/50 cursor-not-allowed outline-none text-sm text-slate-900"
                          value={crawledData.location_id}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <PreviewSection title="Mô tả" content={crawledData.description} onChange={(val) => updateField("description", val)} />
                      <PreviewSection title="Tiện nghi" content={crawledData.amenities} onChange={(val) => updateField("amenities", val)} />
                      <PreviewSection title="Đánh giá" content={crawledData.rating} onChange={(val) => updateField("rating", val)} />
                    </div>

                    <button
                      onClick={handleAIRewrite}
                      disabled={aiGenerating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {aiGenerating ? <><Loader2 className="animate-spin" /> AI đang viết lại nội dung...</> : <><Edit3 size={20} /> Chuyển sang bước 2: AI Viết lại cho Runner</>}
                    </button>
                  </>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bước 2: Nội dung đã tối ưu cho Runner</h4>
                      <button 
                        onClick={() => setStep(1)}
                        className="text-slate-400 hover:text-blue-500 text-xs flex items-center gap-1"
                      >
                        Quay lại bước 1
                      </button>
                    </div>
                    <textarea
                      className="w-full h-64 p-6 text-sm leading-relaxed bg-slate-50 text-slate-800 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={aiContent}
                      onChange={(e) => setAiContent(e.target.value)}
                      placeholder="Nội dung AI sẽ xuất hiện ở đây..."
                    />
                    
                    <div className="flex gap-4">
                      <button
                        onClick={handleAIRewrite}
                        disabled={aiGenerating}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Loader2 className={aiGenerating ? "animate-spin" : "hidden"} /> Thử lại với AI
                      </button>
                      <button
                        onClick={handleConvertToHTML}
                        disabled={aiGenerating || !aiContent}
                        className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        {aiGenerating ? <><Loader2 className="animate-spin" /> Đang tạo HTML...</> : <><Sheet size={20} /> Chuyển sang bước 3: Tạo HTML Template</>}
                      </button>
                    </div>
                  </div>
                )}

                {step >= 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bước 3: HTML Template cho Website</h4>
                      <button 
                        onClick={() => setStep(2)}
                        className="text-slate-400 hover:text-blue-500 text-xs flex items-center gap-1"
                      >
                        Quay lại bước 2
                      </button>
                    </div>
                    <textarea
                      className="w-full h-96 p-6 text-xs font-mono leading-relaxed bg-slate-900 text-emerald-400 rounded-2xl border border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      placeholder="Mã HTML sẽ xuất hiện ở đây..."
                    />
                    
                    <div className="flex gap-4">
                      <button
                        onClick={handleConvertToHTML}
                        disabled={aiGenerating}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Loader2 className={aiGenerating ? "animate-spin" : "hidden"} /> Thử lại với AI
                      </button>
                      <button
                        onClick={handleSubmitToSheet}
                        disabled={submitting || !htmlContent}
                        className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        {submitting ? <><Loader2 className="animate-spin" /> Đang lưu...</> : <><Send size={20} /> Bước 4: Lưu vào Google Sheet</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function PreviewSection({ title, content, onChange }: { title: string, content: string, onChange: (val: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-blue-500 hover:text-blue-600 text-xs font-medium flex items-center gap-1"
        >
          {isEditing ? "Xong" : <><Edit3 size={12} /> Sửa</>}
        </button>
      </div>
      
      {isEditing ? (
        <textarea
          className="w-full h-32 p-3 text-xs font-mono bg-slate-900 text-slate-300 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
          value={content}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="relative group">
          <div className="w-full h-32 p-3 text-[10px] font-mono bg-slate-50 text-slate-500 rounded-lg border border-slate-200 overflow-y-auto whitespace-pre-wrap break-all">
            {content || <span className="italic text-slate-300">Không có dữ liệu</span>}
          </div>
          {content && (
            <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-slate-600">Click "Sửa" để thay đổi</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
