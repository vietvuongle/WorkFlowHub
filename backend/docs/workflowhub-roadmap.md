# WorkFlowHub: đánh giá và lộ trình triển khai

## Đánh giá template

Template hiện tại đã cung cấp NestJS modular monolith, cấu hình và Swagger, TypeORM/PostgreSQL, Redis/BullMQ, JWT/session, validation, Docker Compose và Jest. Vì vậy, giữ nguyên các module nền tảng này sẽ ít rủi ro hơn tạo một ứng dụng NestJS mới.

Các điểm cần lưu ý khi chuyển thành WorkFlowHub:

- User hiện tại nằm trong bảng `"user"` (số ít), không phải `users` như DDL trong đặc tả. Các quan hệ mới cần tham chiếu bảng đang có hoặc phải có migration đổi tên riêng.
- Template có sẵn một số thành phần Auth/Redis/Queue nhưng chưa đồng nghĩa các yêu cầu nâng cao như refresh-token rotation, session thu hồi qua Redis, Kafka, Cloudinary hoặc RBAC đã hoàn tất.
- Frontend React/Vite chưa có trong repository. Lộ trình ưu tiên API theo template; frontend được giữ thành phần riêng để bổ sung sau khi API nghiệp vụ ổn định.
- Migration cũ dùng `uuid_generate_v4()`. Migration bật extension UUID phải chạy trước migration tạo user trên database mới.

## Các phase và tiêu chí hoàn tất

| Phase                               | Phạm vi                                                                                                                  | Definition of Done                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Nền tảng và Workspace            | Tận dụng setup/auth hiện có; chuẩn hóa migration UUID; workspace CRUD, slug duy nhất và giới hạn dữ liệu theo owner.     | API workspace được bảo vệ bởi JWT; owner khác không thể đọc/sửa/xóa; migration chạy trên database sạch; Swagger và test cập nhật. **Đã triển khai; chờ xác nhận migration trên PostgreSQL local.**                           |
| 2. Membership và Dynamic RBAC       | Workspace members, system/custom roles, permissions, role-permissions, permission guard.                                 | Thành viên và quyền có thể cấu hình theo workspace; truy cập trái quyền trả `403`. **Đã triển khai; chờ xác nhận migration trên PostgreSQL local.**                                                                          |
| 3. Projects và Workflow             | Project CRUD, project membership/key, workflow/status/transition và các luật chuyển trạng thái.                          | Tạo project kèm workflow mặc định; chuyển trạng thái chỉ theo transition hợp lệ. **Đã triển khai; chờ xác nhận migration trên PostgreSQL local.**                                                                            |
| 4. Tasks, Dependencies và Sprints   | Task/status, work log có thể sửa, estimate/remaining tự tính, dependency, subtask, optimistic version, sprint lifecycle. | Task key ổn định; sửa/xóa work log cập nhật tổng giờ và remaining; dependency vòng bị từ chối; mỗi project chỉ có tối đa một sprint active. **Đã triển khai; chờ xác nhận migration trên PostgreSQL local.**                 |
| 5. Cộng tác và Realtime             | Task comments/mentions, notifications, WebSocket JWT và Redis adapter.                                                   | Mention tạo notification; thay đổi được phát tới đúng room đã xác thực. **Đã triển khai; chờ áp dụng migration trên PostgreSQL local.**                                                                                      |
| 6. Nền tảng bất đồng bộ và tích hợp | Cache/locks, BullMQ, Cloudinary attachments, activity/audit log, Kafka producer/consumers.                               | Docker PostgreSQL đã xác nhận toàn bộ migration; Redis lock, audit log và upload Cloudinary riêng tư đã được triển khai/kiểm tra. Preset Cloudinary vẫn cần cấu hình giới hạn định dạng và 10 MB; Kafka để lại cho bước sau. |
| 7. Search và Analytics              | Advanced task filters, aggregate reports, velocity/cycle-time/burndown.                                                  | Đã có task search và analytics tổng hợp, velocity, cycle time, burndown; các API có kiểm soát quyền và được kiểm thử.                                                                                                        |
| 8. Chất lượng và phát hành          | Unit/e2e, lint/type-check, Docker production, migration và CI/CD.                                                        | CI chạy lint/type-check/unit/e2e/build/docs/Docker image; production có health check và quy trình migration tường minh. **Frontend được chuyển sang Phase 9.**                                                               |
| 9. Frontend                         | React/Vite client sử dụng API đã ổn định.                                                                                | Các luồng chính của WorkFlowHub được dùng qua giao diện web được kiểm thử.                                                                                                                                                   |

Các phase 2–8 phụ thuộc vào domain và dữ liệu từ phase trước. Kafka và các dịch vụ mới sẽ chỉ được thêm khi có use case cụ thể để tránh đưa hạ tầng chưa cần thiết vào giai đoạn đầu.

### Task attachments trên Cloudinary

Đặt `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` và `CLOUDINARY_TASK_ATTACHMENT_UPLOAD_PRESET` trong `.env`. Tạo signed upload preset trong Cloudinary với `type=authenticated`, `allowed_formats=jpg,png,webp,pdf`, `max_file_size=10485760` và `overwrite=false`. Attachment hỗ trợ JPG/JPEG, PNG, WebP và PDF với giới hạn 10 MB mỗi tệp. Asset được upload bằng chữ ký tạm thời; client xác nhận upload với API, còn API xác minh metadata qua Cloudinary. Chỉ project member có permission task tương ứng mới ký upload, xem hoặc xóa attachment; API chỉ trả private download URL có hạn 5 phút.

Luồng API:

1. `POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments/upload-signature` với `{ "fileName": "design.pdf", "contentType": "application/pdf" }`.
2. POST multipart lên `uploadUrl`: gửi `file`, `api_key=apiKey`, `timestamp`, `signature`, `public_id=publicId`, `type=deliveryType`, `upload_preset=uploadPreset`, `overwrite=false`, `allowed_formats=allowedFormats`. `resourceType` đã nằm trong URL.
3. `POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments/:attachmentId/confirm` để server kiểm tra asset và lưu metadata.
4. `GET` cùng đường dẫn `/attachments` để nhận danh sách kèm URL tải tạm thời; `DELETE /attachments/:attachmentId` để xóa file.

Migration `1760700000000-create-task-attachments` đã được xác nhận áp dụng trên PostgreSQL của Docker Compose; chạy `pnpm migration:show` để xác minh hoặc `pnpm migration:up` trên môi trường PostgreSQL khác trước khi dùng các API này.

Cloudinary đã được kiểm tra từ môi trường Docker bằng upload authenticated thực tế. Upload thành công, nhưng preset hiện tại chưa trả về `allowed_formats` hoặc `max_file_size`; hãy đặt `allowed_formats=jpg,png,webp,pdf` và `max_file_size=10485760` trong Cloudinary để chặn file không hợp lệ trước khi upload, ngoài kiểm tra hậu kiểm của API.

### Phase 7: Tìm kiếm task

- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/search` hỗ trợ `q` (tìm trong key, title, description), `status`, `sprintId`, `parentTaskId`, `page`, `limit` (tối đa 100), `sortBy` và `order`.
- Kết quả có cấu trúc offset pagination `{ data, pagination }`; `GET .../tasks` hiện tại tiếp tục giữ nguyên response array để tương thích.
- Các lựa chọn sắp xếp được whitelist; truy vấn luôn giới hạn vào project và xác minh membership hiện tại trước khi đọc dữ liệu.

### Phase 7: Analytics

Các API bên dưới yêu cầu JWT và quyền đọc task trong workspace; service cũng xác minh người gọi là project member trước khi trả dữ liệu:

- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/analytics/summary`: tổng số task, phân bố theo status, tỷ lệ DONE, estimate/logged/remaining theo giờ.
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/analytics/velocity?limit=6`: tối đa 24 sprint đã COMPLETED gần nhất; velocity là tổng estimate của các task hiện DONE thuộc sprint, và average là trung bình trên các sprint trong mẫu.
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/analytics/cycle-time`: trung bình và median ngày từ lần đầu task chuyển sang IN_PROGRESS đến lần DONE đầu tiên tiếp theo. Chỉ task có activity log ghi nhận cả hai lần chuyển mới được tính.
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/analytics/sprints/:sprintId/burndown`: đường ideal và remaining estimate theo ngày trong sprint. Actual được tính theo estimate hiện tại của task thuộc sprint trừ tổng work log lũy kế trong sprint; đây là estimate-based burn, không phải ảnh chụp lịch sử remaining/status. Sprint dài hơn 366 ngày bị từ chối.

Các report được giới hạn vào workspace/project trong route; truy vấn cycle time dùng activity log nên task chuyển trạng thái trước khi audit log được bật sẽ không xuất hiện trong mẫu cycle-time.

## Phase 1 hiện tại: Workspace API

Các route yêu cầu JWT:

- `POST /api/v1/workspaces`: tạo workspace; slug sinh từ tên và tự thêm hậu tố nếu trùng.
- `GET /api/v1/workspaces`: liệt kê workspace mà user hiện tại là thành viên ACTIVE.
- `GET /api/v1/workspaces/:id`: lấy workspace nếu có `workspace.read`.
- `PATCH /api/v1/workspaces/:id`: cập nhật tên/mô tả nếu có `workspace.update`; slug giữ ổn định.
- `DELETE /api/v1/workspaces/:id`: xóa workspace nếu có `workspace.delete`.

Migration workspace tham chiếu `"user"` hiện có và dùng ràng buộc/index ở PostgreSQL làm lớp bảo vệ dữ liệu cuối cùng.

## Phase 2: Membership và Dynamic RBAC

Các route yêu cầu JWT và permission tương ứng trong workspace:

- `GET /api/v1/workspaces/:workspaceId/permissions` (`roles.read`).
- `GET|POST /api/v1/workspaces/:workspaceId/roles` (`roles.read` / `roles.manage`).
- `PATCH /api/v1/workspaces/:workspaceId/roles/:roleId` (`roles.manage`).
- `GET|POST /api/v1/workspaces/:workspaceId/members` (`members.read` / `members.manage`).
- `PATCH /api/v1/workspaces/:workspaceId/members/:memberId/role` và `/status` (`members.manage`).

Workspace mới được tạo cùng Owner/Admin/Member roles và Owner membership trong một transaction. Migration backfill roles/membership cho workspace đã có. Chỉ user đã đăng ký mới được thêm trực tiếp; lời mời email chưa thuộc phase này. Chỉ Owner được tạo role hoặc gán role có `roles.manage`/`workspace.delete`, tránh nâng quyền qua membership management.

## Phase 3: Projects và Workflow

Các route yêu cầu JWT, workspace membership/permission tương ứng và project membership:

- `GET|POST /api/v1/workspaces/:workspaceId/projects` (`projects.read` / `projects.manage`).
- `GET|PATCH|DELETE /api/v1/workspaces/:workspaceId/projects/:projectId`.
- `GET|POST|DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/members`; chỉ thành viên ACTIVE của workspace được thêm vào project.
- `PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/status` (`workflow.manage`).

Tạo project tự sinh workflow Backlog → In Progress → Done; service chỉ chấp nhận chuyển trạng thái có trong bảng transition. Project key duy nhất trong workspace và không đổi sau tạo. Người tạo được thêm làm project member; danh sách và truy vấn chi tiết chỉ trả project thuộc workspace đó mà user hiện tại là thành viên.

## Phase 4: Tasks và Time Tracking

Task nằm trong project và có key tăng dần theo project. Trạng thái mặc định gồm `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`; `DONE` có thể reopen về `TODO`/`IN_PROGRESS`, còn `CANCELLED` có thể reopen về `TODO`.

- `GET|POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks`.
- `GET|PATCH|DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId`.
- `POST|GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/work-logs`.
- `PATCH|DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/work-logs/:workLogId`; chỉ người tạo work log được sửa/xóa log của mình.
- `PATCH .../tasks/:taskId/remaining` cho phép nhập remaining estimate thủ công sau khi estimate ban đầu không còn đủ.
- `PATCH .../tasks/:taskId/status` đổi trạng thái theo các transition hợp lệ, gồm cancel và reopen.
- Khi tạo task, có thể truyền `parentTaskId` để tạo subtask; `GET .../tasks/:taskId/subtasks` liệt kê subtasks trực tiếp.
- `GET|POST .../tasks/:taskId/dependencies` liệt kê/thêm task prerequisite; `DELETE .../tasks/:taskId/dependencies/:dependencyId` gỡ dependency. Dependency chỉ nằm trong cùng project; DFS từ chối chu trình.
- `GET|POST .../sprints` liệt kê/tạo sprint PLANNED; `POST .../sprints/:sprintId/start|complete|cancel` quản lý vòng đời.
- `GET .../sprints/:sprintId/tasks`, `POST .../sprints/:sprintId/tasks` và `DELETE .../sprints/:sprintId/tasks/:taskId` xem/gán/gỡ task khỏi sprint.

Estimate, logged time và remaining được lưu theo phút; API nhận/trả giờ dạng số thập phân. Khi tạo, sửa hoặc xóa work log, hệ thống tính lại tổng giờ đã log và `remaining = max(estimate - tổng log, 0)`. Work log có thể sửa ngày và số giờ; mọi sửa đổi đều cập nhật lại các giá trị tổng hợp trong transaction. Khi estimate đã hết nhưng task chưa hoàn thành, remaining có thể được đặt thủ công; lần thay đổi work log tiếp theo sẽ tính remaining lại từ estimate và tổng log.

Sprint bắt đầu ở trạng thái `PLANNED`; chỉ `PLANNED → ACTIVE → COMPLETED` hoặc `PLANNED/ACTIVE → CANCELLED` là hợp lệ. PostgreSQL partial unique index bảo đảm tối đa một sprint `ACTIVE` trong mỗi project. Ngày bắt đầu/kết thúc phải hợp lệ và ngày kết thúc không trước ngày bắt đầu. Task chỉ được đưa vào sprint thuộc cùng project và sprint chưa kết thúc.

## Phase 5: Cộng tác và Realtime

- `GET|POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments` đọc/tạo comment; tạo comment nhận `content` và `mentionedUserIds`. Người được mention phải là thành viên của cùng project; task phải thuộc project đã scope.
- Mention tạo notification được lưu cùng transaction với comment. Commenter tự mention mình không tạo notification cho chính mình.
- `GET /api/v1/notifications` trả tối đa 50 notification mới nhất; `GET /api/v1/notifications/unread-count` trả số chưa đọc; `PATCH /api/v1/notifications/:notificationId/read` và `PATCH /api/v1/notifications/read-all` chỉ cập nhật notification của user đang đăng nhập.
- WebSocket namespace `/realtime` nhận access JWT qua Socket.IO handshake `auth.token`; token không hợp lệ bị ngắt kết nối. Socket được gắn vào room riêng `user:<userId>:notifications`; sự kiện `notification.created` chỉ phát tới room người nhận đã xác thực.
- Redis Socket.IO adapter đồng bộ sự kiện giữa các API instance theo Redis config hiện có. Migration `1760500000000-create-comments-and-notifications` tạo comments/notifications cùng khóa ngoại và index.
