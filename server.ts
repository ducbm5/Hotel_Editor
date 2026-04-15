import express from "express";
import { createServer as createViteServer } from "vite";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API route for crawling
  app.post("/api/crawl", async (req, res) => {
    const booking_url = (req.body.booking_url || "").trim();
    const gallery_url = (req.body.gallery_url || "").trim();

    if (!booking_url && !gallery_url) {
      return res.status(400).json({ error: "Vui lòng cung cấp ít nhất một link để crawl" });
    }

    console.log("Crawl Request:", { booking_url, gallery_url });

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      let mainData: any = {
        name: "",
        images: [],
        description: "",
        amenities: "",
        price: "",
        rating: "",
        location: "",
        hotel_id: "",
        location_id: "",
        map_url: ""
      };

      let contentPage: any = null;

      // 1. Crawl Main Content if booking_url is provided
      if (booking_url) {
        contentPage = await browser.newPage();
        await contentPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        await contentPage.setViewport({ width: 1280, height: 800 });
        
        // Use a more robust navigation strategy
        await contentPage.goto(booking_url, { waitUntil: "domcontentloaded", timeout: 60000 });
        
        // Wait for potential redirects and dynamic content
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Ensure we are on the right page and it's stable
        await contentPage.waitForSelector("body", { timeout: 10000 }).catch(() => {});

        // Scroll content page
        await contentPage.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
              window.scrollBy(0, distance);
              totalHeight += distance;
              if (totalHeight > 2000) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        }).catch(err => console.log("Scroll error (ignoring):", err.message));

        // Small pause after scroll
        await new Promise(resolve => setTimeout(resolve, 2000));

        let retries = 3;
        while (retries > 0) {
          try {
            mainData = await contentPage.evaluate(`(async (shouldGetImages) => {
              try {
                const getText = (selectors) => {
                  for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el) return el.innerText || el.textContent || "";
                  }
                  return "";
                };

                const getImages = () => {
                  if (!shouldGetImages) return [];
                  const urls = new Set();
                  const allImgs = document.querySelectorAll("img");
                  allImgs.forEach(img => {
                    const isSmall = img.naturalWidth > 0 && img.naturalWidth < 600 && img.naturalHeight < 600;
                    if (isSmall) return;

                    const src = img.getAttribute("src") || img.getAttribute("data-lazy") || img.getAttribute("data-src") || img.getAttribute("data-highres");
                    if (src && src.startsWith("http") && (src.includes("images/hotel") || src.includes("static/img"))) {
                      const highRes = src.replace(/\\/(max|square|width|height)\\d+(x\\d+)?\\//, "/max1280x900/");
                      urls.add(highRes);
                    }
                  });
                  return Array.from(urls).slice(0, 1000);
                };

                const hotelName = document.querySelector("h2.pp-header__title")?.textContent?.trim() || 
                             document.querySelector("[data-testid='title']")?.textContent?.trim() || 
                             document.querySelector(".hp__hotel-name")?.textContent?.trim() || 
                             document.querySelector("#hp_hotel_name")?.textContent?.trim() || "";

                const provinceMap = {
                  'Hà Nội': '01', 'Hà Giang': '02', 'Cao Bằng': '04', 'Bắc Kạn': '06', 'Tuyên Quang': '07',
                  'Lào Cai': '10', 'Điện Biên': '11', 'Lai Châu': '12', 'Sơn La': '14', 'Yên Bái': '15',
                  'Hoà Bình': '17', 'Thái Nguyên': '19', 'Lạng Sơn': '20', 'Quảng Ninh': '22', 'Bắc Giang': '24',
                  'Phú Thọ': '25', 'Vĩnh Phúc': '26', 'Bắc Ninh': '27', 'Hải Dương': '30', 'Hải Phòng': '31',
                  'Hưng Yên': '33', 'Thái Bình': '34', 'Hà Nam': '35', 'Nam Định': '36', 'Ninh Bình': '37',
                  'Thanh Hóa': '38', 'Nghệ An': '40', 'Hà Tĩnh': '42', 'Quảng Bình': '44', 'Quảng Trị': '45',
                  'Thừa Thiên Huế': '46', 'Đà Nẵng': '48', 'Quảng Nam': '49', 'Quảng Ngãi': '51', 'Bình Định': '52',
                  'Phú Yên': '54', 'Khánh Hòa': '56', 'Ninh Thuận': '58', 'Bình Thuận': '60', 'Kon Tum': '62',
                  'Gia Lai': '64', 'Đắk Lắk': '66', 'Đắk Nông': '67', 'Lâm Đồng': '68', 'Bình Phước': '70',
                  'Tây Ninh': '72', 'Bình Dương': '74', 'Đ Đồng Nai': '75', 'Bà Rịa - Vũng Tàu': '77', 'Hồ Chí Minh': '79',
                  'Long An': '80', 'Tiền Giang': '82', 'Bến Tre': '83', 'Trà Vinh': '84', 'Vĩnh Long': '86',
                  'Đồng Tháp': '87', 'An Giang': '89', 'Kiên Giang': '91', 'Cần Thơ': '92', 'Hậu Giang': '93',
                  'Sóc Trăng': '94', 'Bạc Liêu': '95', 'Cà Mau': '96'
                };

                const breadcrumbs = Array.from(document.querySelectorAll(".breadcrumb_item, [data-testid='breadcrumb-item'], .bui-breadcrumb__item, .bui-breadcrumb__link"));
                let provinceName = "";
                for (const bc of breadcrumbs) {
                  const text = bc.textContent?.trim() || "";
                  for (const province of Object.keys(provinceMap)) {
                    if (text.includes(province)) {
                      provinceName = province;
                      break;
                    }
                  }
                  if (provinceName) break;
                }

                if (!provinceName) {
                  const locality = document.querySelector("meta[property='og:locality']")?.getAttribute("content");
                  if (locality) provinceName = locality;
                  else if (breadcrumbs.length >= 3) {
                    provinceName = breadcrumbs[breadcrumbs.length - 2]?.textContent?.trim().replace(/\\n/g, "").replace(/\\s+/g, " ") || "";
                  }
                }

                let rawLocationId = document.querySelector("input[name='city_id']")?.value || 
                                   document.querySelector("input[name='dest_id']")?.value || "";
                rawLocationId = rawLocationId.replace(/[^0-9]/g, "");

                const finalLocationId = provinceMap[provinceName] || rawLocationId.substring(0, 2);

                return {
                  name: hotelName,
                  images: getImages(),
                  description: getText([
                    "#property_description_content", 
                    "[data-testid='property-description']",
                    ".hp_description_column",
                    "#summary"
                  ]),
                  amenities: getText([
                    "[data-testid='facilities-section']", 
                    "[data-testid='facilities']", 
                    "#hp_facilities_box",
                    ".hp-facilities-section"
                  ]),
                  price: getText([
                    "[data-testid='price-and-discounted-price']", 
                    ".bui-price-display__value",
                    ".prco-wrapper"
                  ]),
                  rating: getText([
                    "[data-testid='review-score']", 
                    ".reviewScore",
                    "#js--hp-gallery-scorecard"
                  ]),
                  location: provinceName,
                  hotel_id: (() => {
                    const id = document.querySelector("input[name='hotel_id']")?.value || 
                               document.querySelector("[data-hotel-id]")?.getAttribute("data-hotel-id") || "";
                    return id.replace(/[^0-9]/g, "");
                  })(),
                  location_id: finalLocationId,
                  map_url: (() => {
                    const latLngEl = document.querySelector("[data-atlas-latlng]");
                    if (latLngEl) {
                      const latLng = latLngEl.getAttribute("data-atlas-latlng");
                      if (latLng) return 'https://www.google.com/maps/search/?api=1&query=' + latLng;
                    }
                    const lat = document.querySelector("meta[property='og:latitude']")?.getAttribute("content");
                    const lng = document.querySelector("meta[property='og:longitude']")?.getAttribute("content");
                    if (lat && lng) return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
                    const mapLink = document.querySelector("a[href*='maps.google.com'], a[href*='google.com/maps']");
                    if (mapLink) return mapLink.getAttribute("href");
                    return "";
                  })()
                };
              } catch (e) {
                return { error: e.message };
              }
            })(${!gallery_url})`);
            break;
          } catch (err: any) {
            if (err.message.includes("Execution context was destroyed") && retries > 1) {
              console.log("Context destroyed, retrying evaluate...");
              await new Promise(resolve => setTimeout(resolve, 2000));
              retries--;
              continue;
            }
            throw err;
          }
        }

        if (mainData.error) {
          throw new Error(mainData.error);
        }
      }

      let galleryImages: string[] = [];

      // 2. Crawl Gallery if gallery_url is provided
      if (gallery_url) {
        const galleryPage = await browser.newPage();
        try {
          await galleryPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
          await galleryPage.setViewport({ width: 1280, height: 800 });
          
          // Use domcontentloaded for faster start, then wait manually
          await galleryPage.goto(gallery_url, { waitUntil: "domcontentloaded", timeout: 60000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Scroll gallery page deeply to trigger lazy loading
          await galleryPage.evaluate(`(async () => {
            await new Promise((resolve) => {
              let totalHeight = 0;
              const distance = 1000;
              const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                // Scroll very deep for galleries to ensure all images load
                if (totalHeight > 30000) {
                  clearInterval(timer);
                  resolve();
                }
              }, 150);
            });
          })()`);

          await new Promise(resolve => setTimeout(resolve, 2000));

          const extraImages = await galleryPage.evaluate(`(() => {
            const urls = new Set();
            // Look for images in various attributes and elements
            const allElements = document.querySelectorAll("img, a, div[style*='background-image'], [data-highres], [data-src], [data-lazy], [data-full-res]");
            
            allElements.forEach(el => {
              let src = el.getAttribute("src") || 
                        el.getAttribute("data-lazy") || 
                        el.getAttribute("data-src") || 
                        el.getAttribute("data-highres") ||
                        el.getAttribute("href") ||
                        el.getAttribute("data-full-res") ||
                        el.getAttribute("data-lazy-src");
              
              // Check for background images
              if (!src && el instanceof HTMLElement) {
                const bg = el.style.backgroundImage;
                if (bg && bg.includes("url(")) {
                  src = bg.slice(4, -1).replace(/['"]/g, "");
                }
              }
              
              if (src && src.startsWith("http")) {
                // Filter for hotel images and common image extensions
                if (src.includes("images/hotel") || src.includes(".jpg") || src.includes(".png") || src.includes(".webp") || src.includes("static/img")) {
                  // Convert to high resolution by replacing the size segment
                  const highRes = src.replace(/\\/(max|square|width|height)\\d+(x\\d+)?\\//, "/max1280x900/");
                  urls.add(highRes);
                }
              }
            });
            return Array.from(urls);
          })()`);

          if (Array.isArray(extraImages) && extraImages.length > 0) {
            galleryImages = extraImages.slice(0, 1000);
          }
        } catch (e: any) {
          console.log("Error crawling gallery_url:", e.message);
        } finally {
          await galleryPage.close();
        }
      } else {
        // If no gallery_url, use images from main page
        galleryImages = mainData.images;

        // Fallback: Try to click "Show all photos" on the main page
        if (contentPage) {
          try {
            const triggerSelector = ".bh-photo-grid-thumb-more, .js-hp-gallery-trigger, [data-testid='gallery-side-reviews-trigger'], .hp-gallery-more-photos, [data-testid='gallery-grid-item-more'], [data-testid='gallery-grid-item-more-link']";
            const galleryTrigger = await contentPage.$(triggerSelector);
            if (galleryTrigger) {
              await galleryTrigger.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const modalImages = await contentPage.evaluate(`(() => {
                const urls = new Set();
                const modal = document.querySelector("[data-testid='gallery-view'], .hp-gallery-slideshow, .gallery-side-reviews-wrapper, .bh-photo-modal");
                if (modal) {
                  const imgs = modal.querySelectorAll("img");
                  imgs.forEach(img => {
                    const src = img.getAttribute("src") || img.getAttribute("data-lazy") || img.getAttribute("data-src") || img.getAttribute("data-highres");
                    if (src && src.startsWith("http")) {
                      const highRes = src.replace(/\\/(max|square|width|height)\\d+(x\\d+)?\\//, "/max1280x900/");
                      urls.add(highRes);
                    }
                  });
                }
                return Array.from(urls);
              })()`);
              
              if (Array.isArray(modalImages) && modalImages.length > 0) {
                const combined = new Set([...galleryImages, ...modalImages]);
                galleryImages = Array.from(combined).slice(0, 1000);
              }
            }
          } catch (e) {}
        }
      }

      const result = {
        url: booking_url || gallery_url,
        gallery_url_used: gallery_url || "none",
        name: mainData.name || "N/A",
        images: galleryImages,
        description: (mainData.description || "").trim(),
        amenities: (mainData.amenities || "").trim(),
        price: (mainData.price || "").trim(),
        rating: (mainData.rating || "").trim(),
        location: (mainData.location || "").trim(),
        hotel_id: mainData.hotel_id || "",
        location_id: mainData.location_id || "",
        map_url: mainData.map_url || "",
      };

      res.json(result);
    } catch (error: any) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: "Lỗi khi crawl dữ liệu: " + error.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;

if (process.env.NODE_ENV !== "production") {
  startServer();
}
