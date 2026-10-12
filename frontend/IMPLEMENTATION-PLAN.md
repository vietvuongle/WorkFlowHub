# Kế hoạch xây dựng frontend WorkFlowHub

## 1. Mục tiêu

Chuyển frontend mẫu hiện tại thành giao diện quản lý công việc WorkFlowHub, kết nối với API trong `backend`. Giao diện hướng enterprise SaaS, light theme, responsive, nhất quán và không thêm hiệu ứng trang trí không cần thiết.

Tài liệu này là kế hoạch triển khai; chưa thay đổi giao diện hoặc mã nguồn ứng dụng.

## 2. Hiện trạng, phạm vi dọn dẹp và nguyên tắc chuyển đổi

- Frontend dùng Angular standalone, lazy routes, signals, Angular CDK, Geist và CSS design tokens. Dependencies hiện khai báo Angular `22.x`; phải kiểm tra phiên bản CLI/Angular thực tế trước khi tạo code hoặc chọn API Angular mới.
- Các route và tính năng `pizzerias`, `cart`, `checkout`, `orders` thuộc ứng dụng pizza và không có backend tương ứng trong WorkFlowHub; sẽ được gỡ bỏ cùng luồng đăng ký/chọn vai trò dành riêng cho pizzeria.
- Loại bỏ code chỉ phục vụ pizza sau khi kiểm tra tham chiếu/import và cập nhật route/tests: pizza/pizzeria/order/cart models và services, checkout wizard/guards, tra cứu Photon/location/address, catalog-image pipe, pizza logo, role/guard dành cho `CUSTOMER`/`PIZZERIA_ADMIN` cùng UI quản trị pizzeria.
- Không xóa hàng loạt component dùng chung. Kiểm tra từng component/service trước khi giữ, sửa hoặc xóa: ưu tiên tái sử dụng button, input, modal/dialog, avatar, spinner, callout, empty state, pagination và status badge nếu phù hợp với thiết kế mới; loại bỏ hoặc thay thế header/footer, role directive, profile, auth hoặc shared component nào còn gắn chặt với nghiệp vụ pizza.
- Auth frontend hiện gọi endpoint và dùng role khác backend WorkFlowHub. Giữ lại route/UX auth phù hợp nếu có thể, nhưng thay service, models, guards và form integration theo DTO/token contract backend; không xem implementation hiện tại là tương thích sẵn.
- Backend cung cấp các mô-đun nghiệp vụ WorkFlowHub: auth, users, workspaces, workspace members/roles, projects, tasks, sprints, analytics, notifications và activity.
- Giữ Angular standalone, lazy loading, quy ước và công cụ hiện tại; tái sử dụng phần dùng chung sau khi xác nhận, không dựng lại ứng dụng hoặc thêm thư viện UI nếu không cần thiết.
- Khi bắt đầu chuyển đổi, thay route demo bằng route WorkFlowHub đã thống nhất và chuyển route gốc tới ứng dụng mới sau khi có auth/workspace flow cơ bản. Tránh duy trì hai bộ sản phẩm trong thời gian dài; nếu cần rollout song song thì phải có quyết định rõ về thời hạn và route giữ lại.
- Lấy schema request/response và quyền thực tế từ Swagger khi chạy backend hoặc DTO/controller; tài liệu dưới đây xác định phạm vi tích hợp, không thay thế schema API.

### Quy tắc triển khai Angular

Tuân theo `frontend/.agents/skills/angular-developer/SKILL.md` và các reference liên quan trong skill ở mọi giai đoạn triển khai:

- Kiểm tra phiên bản Angular trước khi dùng API hoặc tạo code; dùng Angular CLI để scaffold components, services, directives, pipes và routes thay vì tự tạo cấu trúc tùy tiện.
- Ưu tiên Signals cho state/reactivity và tham khảo hướng dẫn forms trong skill; chọn Signal Forms cho form mới khi phù hợp với Angular 22, hoặc Reactive Forms cho form phức tạp/đang theo pattern hiện hữu sau khi đánh giá.
- Theo hướng dẫn routing, accessibility, component styling, responsive và testing tương ứng với từng phần việc; dùng CSS/component styles và design tokens hiện có làm nền.
- Kiểm tra setup Tailwind hiện tại trước khi chọn cách styling. Không thêm Tailwind chỉ vì skill có hướng dẫn; nếu quyết định dùng thì chỉ dùng Tailwind CSS v4 theo `references/tailwind-css.md` (`ng add tailwindcss` hoặc setup v4 được hướng dẫn), không dùng cấu hình/directives v3.
- Sau mỗi đợt tạo/sửa code Angular, chạy `ng build`, phân tích và sửa lỗi build trước khi kết thúc; đồng thời chạy lint và các unit tests liên quan.

## 3. Phạm vi chức năng theo API hiện có

| Khu vực giao diện | Dữ liệu/chức năng API | Ghi chú phạm vi |
| --- | --- | --- |
| Dashboard | Workspace activity; summary, velocity, cycle-time và burndown theo project | Chọn workspace/project trước khi tải phân tích; không giả định có endpoint dashboard tổng hợp toàn hệ thống. |
| Workspaces | Tạo, liệt kê, xem, cập nhật và xóa workspace | Tôn trọng quyền truy cập của người dùng hiện tại. |
| Projects | Liệt kê, tạo, xem, cập nhật, xóa, trạng thái workflow và thành viên project | Có thể đặt bộ chọn project trong header hoặc navigation của vùng ứng dụng. |
| Tasks | Danh sách, tìm kiếm/lọc, tạo/cập nhật/xóa, đổi trạng thái, task con, dependency, comment, work log và attachment | Dùng endpoint search có phân trang cho danh sách cần lọc; hiển thị lỗi/empty/loading rõ ràng. |
| Kanban | Tái sử dụng danh sách task và trạng thái workflow của project; cập nhật bằng API đổi trạng thái | Backend không có endpoint Kanban riêng. Xác minh mô hình trạng thái và quy tắc chuyển trạng thái trước khi cho phép kéo-thả. |
| Sprints | Danh sách/chi tiết, tạo, bắt đầu, hoàn thành, hủy sprint và gán/gỡ task | Kết hợp với màn hình task và biểu đồ burndown khi có sprint. |
| Thành viên và quyền | Danh sách/thêm thành viên workspace; cập nhật role/trạng thái; roles và permissions | Không hiển thị hành động quản trị cho người dùng thiếu permission; trình bày lỗi 403 có hướng dẫn. |
| Báo cáo | Project summary, sprint velocity, cycle time, sprint burndown | Chỉ cung cấp các báo cáo tương ứng API; không dựng số liệu giả khi dữ liệu rỗng. |
| Thông báo | Danh sách, số chưa đọc, đánh dấu đã đọc và đánh dấu tất cả đã đọc | Có REST API. Cập nhật trực tiếp theo realtime chỉ sau khi kiểm tra contract của WebSocket/gateway. |
| Tài khoản | Hồ sơ người dùng hiện tại, cập nhật user, đổi mật khẩu, đăng xuất | Đăng ký/đăng nhập/xác minh/quên mật khẩu theo auth API hiện tại. |
| Lịch | Chưa thấy API lịch hoặc truy vấn công việc theo ngày trong các mô-đun hiện có | Để ngoài điều hướng chính hoặc hiển thị là ngoài phạm vi cho tới khi xác nhận trường ngày và API phù hợp. Không tạo route có nội dung giả. |
| Tìm kiếm toàn cục | API tìm kiếm task theo project hiện có | Bắt đầu bằng tìm kiếm trong project hiện chọn; chưa khẳng định có tìm kiếm toàn workspace. |

## 4. Điều hướng và cấu trúc route đề xuất

Các route dưới đây là đề xuất cho frontend, không phải route API. Chúng thay thế route nghiệp vụ pizza sau khi hoàn tất kiểm tra dependency và gỡ tính năng cũ.

```text
/app
  /dashboard
  /workspaces
  /workspaces/:workspaceId/projects
  /workspaces/:workspaceId/projects/:projectId
  /workspaces/:workspaceId/projects/:projectId/tasks
  /workspaces/:workspaceId/projects/:projectId/board
  /workspaces/:workspaceId/projects/:projectId/sprints
  /workspaces/:workspaceId/projects/:projectId/reports
  /workspaces/:workspaceId/members
  /workspaces/:workspaceId/settings
  /notifications
  /account
```

- Dùng `/auth/...` hiện có nếu route có thể tái sử dụng; cập nhật nội dung và tích hợp API bên trong theo contract backend, không tạo route auth trùng.
- Đặt route `/app` dưới guard xác thực. Với route cần workspace/project, tải dữ liệu và xử lý trường hợp workspace/project không tồn tại hoặc người dùng không có quyền.
- Xóa redirect gốc tới `/pizzerias` và import route/guard checkout sau khi chuyển hướng tới dashboard WorkFlowHub; kiểm tra toàn bộ deep links và fallback `**`.
- Menu sidebar chỉ đưa Calendar hoặc mục tính năng khác vào sau khi có API và scope được xác nhận.

## 5. Bộ khung ứng dụng dùng lại

### Sidebar

- Sidebar trắng, logo/tên WorkFlowHub và các nhóm mục điều hướng theo mô-đun API: Tổng quan, Workspace, Dự án/Công việc, Thành viên, Báo cáo, Thông báo và Tài khoản/Cài đặt.
- Liên kết active dựa trên Angular Router; trạng thái hover/active nhẹ, icon và nhãn nhất quán.
- Desktop/laptop: có thể thu gọn/mở rộng, lưu lựa chọn nếu cần; khi thu gọn vẫn có tooltip/accessible label cho icon.
- Tablet/mobile: chuyển thành drawer phủ nội dung, có nút mở/đóng, đóng sau khi chọn route; bảo đảm focus và thao tác bàn phím.
- Không hiển thị menu/hành động quản trị nếu user không có quyền tương ứng.

### Header

- Nút toggle sidebar, breadcrumb hoặc tên route, bộ chọn workspace/project khi cần, tìm kiếm task trong project hiện chọn, thông báo kèm unread count, avatar và menu tài khoản.
- Menu tài khoản liên kết tới hồ sơ/đổi mật khẩu và đăng xuất theo API thực tế.
- Đồng bộ chiều rộng/căn lề với main content; header không tạo thêm thanh cuộn ngang trên viewport nhỏ.

### Main content

- Có tiêu đề, mô tả tùy chọn và vùng hành động cấp trang; dùng lưới responsive cho metric cards, bảng, danh sách và widget.
- Trang danh sách cần hỗ trợ loading, empty, error, retry, phân trang/lọc nếu API cung cấp.
- Dialog/form cần nhãn, lỗi validation, trạng thái đang gửi và chống gửi lặp; xác nhận trước hành động phá hủy.

## 6. Design system và responsive

Khai báo hoặc điều chỉnh CSS custom properties trong design system đang có. Palette theo yêu cầu:

| Token | Giá trị |
| --- | --- |
| Primary / hover / light | `#5D87FF` / `#4570E8` / `#ECF2FF` |
| Page / card / sidebar | `#F6F9FC` / `#FFFFFF` / `#FFFFFF` |
| Primary / secondary text | `#2A3547` / `#5A6A85` |
| Border | `#E5EAF2` |
| Success / light | `#13DEB9` / `#E6FFFA` |
| Info | `#539BFF` |
| Warning / light | `#FFAE1F` / `#FFF4E5` |
| Danger / light | `#FA896B` / `#FDEDE8` |

- Nền trang xám-xanh nhạt; cards và sidebar trắng, viền mảnh, shadow mềm và tiết chế.
- Dùng primary blue cho hành động chính; semantic colors chỉ cho trạng thái, không dùng làm màu trang trí.
- Bo góc nhất quán cho cards, input, buttons và dialogs; phân cấp typography rõ ràng giữa tiêu đề trang/phần, metrics và helper text.
- Dùng spacing/radius/shadow/typography tokens thay vì giá trị rời rạc theo từng component. Giữ Geist nếu phù hợp với bộ nhận diện.
- Tránh gradient, glassmorphism, shadow nặng và animation trang trí; chỉ dùng chuyển động ngắn khi hỗ trợ trạng thái drawer/dialog và tôn trọng `prefers-reduced-motion`.

Điểm kiểm tra theo viewport:

| Kích thước | Hành vi |
| --- | --- |
| Desktop: từ 1440px | Sidebar đầy đủ, vùng nội dung rộng và grid nhiều cột cân đối. |
| Laptop: 1024–1439px | Sidebar hỗ trợ thu gọn; giới hạn độ rộng bảng/widget và giữ thứ bậc nội dung. |
| Tablet: 768–1023px | Sidebar thu gọn hoặc drawer; giảm số cột; bảng có cách trình bày phù hợp, không gây tràn trang. |
| Mobile: dưới 768px | Sidebar dạng drawer; header/action gọn; cards một cột; form và dialog vừa màn hình; không cuộn ngang toàn trang. |

## 7. Tích hợp API và xác thực

- API backend mặc định theo tài liệu là `/api/v1`; prefix có thể cấu hình. Tạo/cập nhật cấu hình môi trường frontend để trỏ tới API WorkFlowHub đang chạy, không giữ `api.realworldangular.org`.
- Frontend hiện có base URL interceptor chỉ xử lý URL bắt đầu bằng `/api`; tái sử dụng hoặc điều chỉnh theo quy ước API version đã chọn để tránh ghép prefix hai lần.
- Luồng auth trong frontend mẫu và endpoint backend khác nhau. Đối chiếu request/response DTO, lưu trữ access/refresh token, refresh, logout và profile bootstrap trước khi nối màn hình; không dựa vào endpoint `/api/auth/me` hiện tại như thể backend đã hỗ trợ.
- Backend bảo vệ phần lớn API bằng bearer access token và endpoint đăng nhập trả token. Xác minh header/token contract, refresh flow và CORS với môi trường chạy trước khi hoàn thiện interceptor/guard.
- Tạo typed API services theo domain (auth/users, workspaces, projects, tasks, sprints, analytics, notifications/activity); response models bám sát DTO backend, tránh định nghĩa cấu trúc suy đoán.
- Xử lý 401 (refresh hoặc đưa về đăng nhập), 403 (không đủ quyền), 422 (validation), lỗi mạng và dữ liệu rỗng minh bạch; không giả lập thành công hoặc nuốt lỗi.
- Kiểm soát truy cập tại UI chỉ hỗ trợ trải nghiệm; backend vẫn là nguồn quyết định cuối cùng về quyền.

## 8. Các giai đoạn triển khai

### Giai đoạn 0 — Chốt contract và cấu hình

1. Chạy backend development và kiểm tra Swagger, `backend/docs/api.md`, DTO cùng request/response cho các màn hình ưu tiên.
2. Xác nhận API base URL/prefix theo từng môi trường, CORS, bearer token/refresh, profile endpoint, các permission và cách nhận biết trạng thái workflow.
3. Xác nhận thứ tự ưu tiên dashboard, board và báo cáo; giữ lịch ngoài phạm vi nếu chưa có API/dữ liệu ngày.

**Hoàn tất khi:** frontend biết rõ cách gọi API, xác thực hoạt động và các route/screen đã chọn đều có contract xác nhận.

### Giai đoạn 1 — Foundation và application shell

1. Rà soát dependency/import, route, test và asset; gỡ các feature pizza đã xác định cùng mọi liên kết còn sót, đồng thời giữ/sửa các tiện ích shared thực sự dùng lại.
2. Cập nhật environment/interceptor/auth service theo API backend; thay đổi profile/guards/models và auth forms theo token, DTO, refresh và permission contract.
3. Bổ sung shell WorkFlowHub với sidebar, header, breadcrumb, vùng nội dung và route guard; chuyển redirect gốc sang ứng dụng mới.
4. Thêm palette, tokens, shared buttons/cards/form states và behavior responsive theo design system hiện tại.
5. Thêm workspace/project selector và xử lý loading, error, empty state.

**Hoàn tất khi:** route/guard pizza không còn được tham chiếu; người dùng xác thực có thể vào shell, chọn workspace/project và sử dụng menu ở cả bốn nhóm viewport; `ng build` thành công.

### Giai đoạn 2 — Core workflow

1. Xây workspace/project list, chi tiết và các thao tác được cho phép.
2. Xây task list/search/filter, form create/edit, task detail và cập nhật status.
3. Xây Kanban dùng cùng nguồn task; xác minh workflow transitions và khả năng đổi status trước khi bật drag-and-drop.
4. Thêm sprint list/detail và thao tác gán task nếu phù hợp với contract.

**Hoàn tất khi:** thao tác tạo/xem/sửa task/project cập nhật dữ liệu server và thông báo lỗi/quyền đúng.

### Giai đoạn 3 — Dashboard, reports, collaboration

1. Hiển thị project summary và activity; hiển thị báo cáo velocity/cycle time/burndown theo API.
2. Thêm danh sách thông báo, unread count, thao tác đọc và badge header.
3. Thêm thành viên workspace/project cùng giao diện role/status có kiểm tra permission.
4. Thêm comments, work logs và attachments cho task theo thứ tự ưu tiên sản phẩm.

**Hoàn tất khi:** thông tin chỉ đến từ API thật, empty/error states rõ và không hiển thị dữ liệu tổng hợp sai phạm vi.

### Giai đoạn 4 — Account, polish và chuyển giao

1. Hoàn thiện hồ sơ, đổi mật khẩu, logout và các luồng auth còn thiếu so với API; dọn các models/components chỉ dành cho pizza đã hết tham chiếu.
2. Kiểm tra keyboard/focus, labels, contrast, mobile drawer, bảng và dialog.
3. Chạy `ng build` sau mỗi đợt code Angular và production build cuối; chạy lint, unit tests liên quan và kiểm thử luồng end-to-end trọng yếu trên API development.
4. Xác nhận không còn route pizza, package/import/asset/test chết; kiểm tra `src` chỉ còn feature WorkFlowHub và các trang dùng chung cần thiết.

**Hoàn tất khi:** luồng cốt lõi hoạt động end-to-end, responsive, không còn lỗi build/lint/test liên quan và phần frontend không liên quan đã được gỡ an toàn.

## 9. Tiêu chí nghiệm thu

- Có application shell tái sử dụng; route active, sidebar collapse/drawer, breadcrumb, thông báo và menu tài khoản hoạt động.
- Giao diện tuân thủ palette, spacing, bo góc, phân cấp typography và phong cách tiết chế đã nêu.
- Layout được kiểm tra ở 1440px+, 1024–1439px, 768–1023px và dưới 768px; không có cuộn ngang toàn trang.
- Luồng auth, workspace/project, task và các màn hình trong phạm vi dùng đúng endpoint/DTO backend; không thêm route gây trùng với route hiện có.
- Giao diện tôn trọng permission và thể hiện loading, empty, validation, error, retry phù hợp.
- Không dựng dashboard, calendar hoặc báo cáo bằng dữ liệu giả khi API chưa cung cấp.
- Lint, test phù hợp và production build frontend đều đạt trước khi chuyển route gốc/phát hành.
- Các tính năng pizza và phụ thuộc riêng đã xóa sau khi xác minh không còn consumer; tiện ích shared được giữ lại có lý do sử dụng cụ thể.
- Quy trình code Angular tuân theo `SKILL.md`, bao gồm kiểm tra phiên bản, scaffold bằng CLI khi tạo mới và chạy `ng build` sau khi tạo/sửa code.

## 10. Tài liệu tham chiếu trong repository

- `backend/docs/api.md`
- `backend/src/api/auth/auth.controller.ts`
- `backend/src/api/workspace/workspace.controller.ts`
- `backend/src/api/workspace/workspace-access.controller.ts`
- `backend/src/api/project/project.controller.ts`
- `backend/src/api/task/task.controller.ts`
- `backend/src/api/sprint/sprint.controller.ts`
- `backend/src/api/analytics/analytics.controller.ts`
- `backend/src/api/collaboration/notifications.controller.ts`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/core/interceptors/base-url.interceptor.ts`
- `frontend/src/app/core/services/auth.ts`
- `frontend/src/styles.css`
- `frontend/src/styles/design-system/`
