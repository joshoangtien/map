# Bản đồ Việt Nam

Bản đồ 3D tương tác của Việt Nam chạy trên trình duyệt. Đây là nền móng cho game: sau này người chơi sẽ bấm vào một địa điểm để vào bên trong nó.

## MVP 1 – có gì

- Mở màn từ quả địa cầu bay vào Việt Nam.
- Zoom, xoay, nghiêng bản đồ. Chuột phải + kéo, hoặc Ctrl + kéo; trên điện thoại dùng hai ngón.
- Đường phố, sông hồ, rừng, công viên, đồi núi (hillshade), nhà 3D theo chiều cao thật.
- Bật/tắt **địa hình 3D** và chuyển **địa cầu / bản đồ phẳng**.
- Nút nhảy nhanh tới Hà Nội, Huế, Đà Nẵng, Hội An, Đà Lạt, TP.HCM, Cần Thơ.
- **Địa điểm bấm được** (từ zoom 14): nơi thờ tự, trường học, bệnh viện, quán ăn, chợ... Bấm vào sẽ hiện bảng thông tin. Nhà thờ, chùa, đình, đền được nhận diện theo tên. Nút "Vào địa điểm" để dành cho MVP 2.
- Ưu tiên tên tiếng Việt (`name:vi`).
- **Chủ quyền:** ẩn nhãn đảo/biển gốc ở khu vực Hoàng Sa, Trường Sa và Biển Đông; ẩn ranh giới tranh chấp và ranh giới trên biển. Thay bằng nhãn "Quần đảo Hoàng Sa (Việt Nam)", "Quần đảo Trường Sa (Việt Nam)", "Biển Đông", "Vịnh Bắc Bộ"... (xem `src/map/sovereignty.ts`).

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

```bash
npm run build          # build ra thư mục dist/ (web tĩnh, host ở đâu cũng được)
npm run validate-style # kiểm tra style bản đồ theo đặc tả MapLibre
```

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/map/style.ts` | Style bản đồ: các lớp đất, nước, đường, nhà 3D, nhãn, POI |
| `src/map/sovereignty.ts` | Nhãn chủ quyền và vùng ẩn nhãn gốc |
| `src/map/poi.ts` | Phân nhóm địa điểm, màu, tên loại bằng tiếng Việt |
| `src/map/places.ts` | Khung nhìn Việt Nam và các điểm nhảy nhanh |
| `src/map/worker.ts` | Trỏ đúng file worker của MapLibre cho Vite |
| `src/components/MapView.tsx` | Khởi tạo bản đồ, xử lý bấm chọn địa điểm |
| `src/components/PoiPanel.tsx` | Bảng thông tin địa điểm |
| `src/App.tsx` | Giao diện: thanh trên, nút công cụ, chú giải |

## Nguồn dữ liệu

- Vector tile: [OpenFreeMap](https://openfreemap.org) (schema OpenMapTiles), dữ liệu © OpenStreetMap. Miễn phí, không cần API key.
- Độ cao: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) trên AWS.
- Font chữ: lấy từ OpenFreeMap (Noto Sans, có đủ dấu tiếng Việt).

Hiện app tải tile trực tiếp từ OpenFreeMap. Khi cần chủ động hơn (offline, tự host, gộp thêm Microsoft/Google Buildings), có thể cắt riêng vùng Việt Nam ra file PMTiles.
