import express from "express";
import { createServer as createViteServer } from "vite";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API route for crawling
  app.post("/api/crawl", async (req, res) => {
    const { booking_url } = req.body;

    if (!booking_url) {
      return res.status(400).json({ error: "Vui lòng cung cấp link Booking.com" });
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      // Set a realistic user agent
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      
      // Navigate to the URL
      await page.goto(booking_url, { waitUntil: "networkidle2", timeout: 60000 });

      // Wait for a bit to let any redirects settle
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Scroll down in increments to trigger all lazy loading
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight > 5000) {
              clearInterval(timer);
              resolve(true);
            }
          }, 100);
        });
      }).catch(() => {});
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for the main content to load - use a more stable selector
      await page.waitForSelector("body", { timeout: 10000 });
      
      // Extract data using Puppeteer's evaluate
      // We use a string to avoid tsx/esbuild injecting helpers like __name into the function
      const rawData: any = await page.evaluate(`(() => {
        try {
          const getText = (selectors) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el) return el.innerText || el.textContent || "";
            }
            return "";
          };

          const getImages = (selectors) => {
            const urls = new Set();
            
            // 1. Try to find high-res images in common gallery selectors
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector + " img, " + selector + " a");
              elements.forEach(el => {
                let src = el.getAttribute("data-highres") || 
                          el.getAttribute("data-lazy") || 
                          el.getAttribute("data-src") || 
                          el.getAttribute("href") ||
                          el.getAttribute("src");
                
                // If it's a srcset, get the last (usually largest) one
                const srcset = el.getAttribute("srcset");
                if (srcset) {
                  const parts = srcset.split(",").map(p => p.trim().split(" ")[0]);
                  src = parts[parts.length - 1];
                }

                if (src && src.startsWith("http") && (src.includes(".jpg") || src.includes(".png") || src.includes(".webp"))) {
                  // Booking.com size patterns: max500, max300, square60, max1024x768, etc.
                  // We want to replace these with a high-res version like max1280x900
                  let highRes = src.replace(/\\/(max|square|width|height)\\d+(x\\d+)?\\//, "/max1280x900/");
                  
                  // Some URLs might have the size in the query params or at the end
                  if (highRes === src) {
                    highRes = src.replace(/max\\d+x\\d+/, "max1280x900");
                  }
                  
                  urls.add(highRes);
                }
              });
            }

            // 2. Fallback: Look for any large images in the page that might be in the gallery
            if (urls.size < 5) {
              const allImgs = document.querySelectorAll("img[src*='images/hotel']");
              allImgs.forEach(img => {
                const src = img.getAttribute("src");
                if (src) {
                  const highRes = src.replace(/\\/(max|square|width|height)\\d+(x\\d+)?\\//, "/max1280x900/");
                  urls.add(highRes);
                }
              });
            }

            return Array.from(urls).slice(0, 40); // Increase limit to 40
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
            'Tây Ninh': '72', 'Bình Dương': '74', 'Đồng Nai': '75', 'Bà Rịa - Vũng Tàu': '77', 'Hồ Chí Minh': '79',
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

          let rawLocationId = document.querySelector("input[name='city_id']")?.getAttribute("value") || 
                             document.querySelector("input[name='dest_id']")?.getAttribute("value") || "";
          rawLocationId = rawLocationId.replace(/[^0-9]/g, "");

          const finalLocationId = provinceMap[provinceName] || rawLocationId.substring(0, 2);

          return {
            name: hotelName,
            images: getImages([
              "[data-testid='property-gallery']", 
              ".property-gallery", 
              "#hotel_main_content",
              ".hp-gallery-grid",
              ".clearfix.hp_gallery_main"
            ]),
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
              const id = document.querySelector("input[name='hotel_id']")?.getAttribute("value") || 
                         document.querySelector("[data-hotel-id]")?.getAttribute("data-hotel-id") || "";
              return id.replace(/[^0-9]/g, "");
            })(),
            location_id: finalLocationId,
            map_url: (() => {
              // 1. Try to find coordinates in data attributes
              const latLngEl = document.querySelector("[data-atlas-latlng]");
              if (latLngEl) {
                const latLng = latLngEl.getAttribute("data-atlas-latlng");
                if (latLng) return 'https://www.google.com/maps/search/?api=1&query=' + latLng;
              }

              // 2. Try meta tags
              const lat = document.querySelector("meta[property='og:latitude']")?.getAttribute("content");
              const lng = document.querySelector("meta[property='og:longitude']")?.getAttribute("content");
              if (lat && lng) return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;

              // 3. Try any link that looks like a map link
              const mapLink = document.querySelector("a[href*='maps.google.com'], a[href*='google.com/maps']");
              if (mapLink) return mapLink.getAttribute("href");

              return "";
            })()
          };
        } catch (e) {
          return { error: e.message };
        }
      })()`);

      if (rawData.error) {
        throw new Error(rawData.error);
      }

      const result = {
        url: booking_url,
        name: rawData.name,
        images: rawData.images,
        description: rawData.description.trim(),
        amenities: rawData.amenities.trim(),
        price: rawData.price.trim(),
        rating: rawData.rating.trim(),
        location: rawData.location.trim(),
        hotel_id: rawData.hotel_id,
        location_id: rawData.location_id,
        map_url: rawData.map_url,
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
  } else {
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

startServer();
