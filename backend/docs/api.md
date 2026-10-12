# Tài liệu API WorkFlowHub

Tài liệu này mô tả các route hiện có trong source code. Schema request/response đầy đủ và ví dụ tương tác có thể xem tại Swagger khi chạy ứng dụng ở môi trường development: `http://localhost:<PORT>/api-docs`.

[[toc]]

## Quy ước chung

- API có version dùng prefix mặc định `/api/v1`. Nếu đổi `API_PREFIX`, phần prefix `/api` sẽ thay đổi theo cấu hình.
- Hai route `GET /` và `GET /health` không dùng prefix hoặc version.
- Trừ các route được ghi là **Public**, request cần gửi access token:

  ```http
  Authorization: Bearer <access-token>
  ```

- Các route thuộc workspace/project/task còn yêu cầu membership và permission tương ứng. `workspaceId`, `projectId`, `taskId` và các ID tương tự phải là UUID hợp lệ.
- DTO được kiểm tra đầu vào; thuộc tính không khai báo trong DTO sẽ bị loại bỏ. Lỗi validation trả HTTP `422`.
- Các bảng dưới đây ghi permission bổ sung cho route workspace-scoped; tất cả các route đó vẫn cần đăng nhập.

## Health và trang gốc

| Method | Path      | Truy cập | Chức năng                                           |
| ------ | --------- | -------- | --------------------------------------------------- |
| `GET`  | `/`       | Public   | Trả thông điệp chào mừng API.                       |
| `GET`  | `/health` | Public   | Kiểm tra health của ứng dụng và kết nối PostgreSQL. |

Trong development, health check còn kiểm tra trang Swagger. Swagger UI chỉ được khởi tạo ở development.

## Đăng ký, đăng nhập và xác minh email

Prefix: `/api/v1/auth`

| Method | Path                      | Truy cập | Chức năng                                                                                                |
| ------ | ------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `POST` | `/email/register`         | Public   | Đăng ký bằng email và mật khẩu; tài khoản cần xác minh email theo luồng xác minh hiện có.                |
| `POST` | `/email/login`            | Public   | Đăng nhập bằng email và mật khẩu; trả thông tin phiên/token.                                             |
| `POST` | `/refresh`                | Public   | Đổi refresh token lấy token mới.                                                                         |
| `POST` | `/logout`                 | Bearer   | Đăng xuất phiên/token hiện tại.                                                                          |
| `GET`  | `/verify/email?token=...` | Public   | Xác minh email bằng token và trả trang HTML thành công.                                                  |
| `POST` | `/verify/email/resend`    | Public   | Gửi lại email xác minh.                                                                                  |
| `POST` | `/forgot-password`        | Public   | Yêu cầu email hướng dẫn đặt lại mật khẩu. Luôn trả cùng một thông báo dù email có tài khoản hay không.   |
| `POST` | `/verify/forgot-password` | Public   | Kiểm tra JWT reset còn hạn, đang là token mới nhất và thuộc tài khoản còn tồn tại.                       |
| `POST` | `/reset-password`         | Public   | Đặt mật khẩu mới bằng reset token hợp lệ; token chỉ dùng được một lần. Hủy các phiên đăng nhập hiện tại. |

Body cho đăng nhập và đăng ký có `email` và `password`. Route resend verification và forgot password nhận `{ "email": "user@example.com" }`; route refresh nhận `{ "refreshToken": "..." }`. Verify reset nhận `{ "token": "..." }`; reset password nhận `{ "token": "...", "password": "NewPassword123!" }`. Mật khẩu phải đạt quy tắc `PasswordField` (tối thiểu 6 ký tự và ký tự được hỗ trợ bởi validator hiện tại).

Luồng quên mật khẩu:

1. Gọi `POST /forgot-password` với email. Phản hồi luôn chung để không tiết lộ email có đăng ký hay không.
2. Nếu email thuộc tài khoản đã xác minh, hệ thống gửi token qua email. Token dùng secret `AUTH_FORGOT_SECRET`, có thời hạn theo `AUTH_FORGOT_TOKEN_EXPIRES_IN` (mẫu mặc định `15m`); yêu cầu mới làm token trước đó mất hiệu lực.
3. Gọi `POST /verify/forgot-password` với token để kiểm tra token trước khi hiển thị form đặt mật khẩu mới.
4. Gọi `POST /reset-password` với cùng token và mật khẩu mới. Token được tiêu thụ sau khi đổi mật khẩu; các phiên access/refresh đang hoạt động bị thu hồi và người dùng cần đăng nhập lại.

## Người dùng

Prefix: `/api/v1/users` — các route trong nhóm này cần Bearer token.

| Method   | Path                  | Chức năng                                                                                                                                                             |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/me`                 | Lấy hồ sơ người dùng đang đăng nhập.                                                                                                                                  |
| `POST`   | `/`                   | Tạo user.                                                                                                                                                             |
| `GET`    | `/`                   | Lấy danh sách user theo phân trang offset.                                                                                                                            |
| `GET`    | `/load-more`          | Lấy danh sách user theo phân trang cursor.                                                                                                                            |
| `GET`    | `/:id`                | Lấy user theo UUID.                                                                                                                                                   |
| `PATCH`  | `/:id`                | Cập nhật user theo UUID.                                                                                                                                              |
| `DELETE` | `/:id`                | Xóa user theo UUID.                                                                                                                                                   |
| `POST`   | `/me/change-password` | Đổi mật khẩu bằng `{ "currentPassword": "...", "newPassword": "..." }`; sai mật khẩu hiện tại trả `401`. Thu hồi các phiên hiện tại nên người dùng cần đăng nhập lại. |

Các route user ngoài `/me` hiện chỉ áp dụng xác thực chung; không nên hiểu đây là cơ chế phân quyền admin hoặc tự giới hạn vào user hiện tại.

## Workspace và quyền truy cập

### Workspace

Prefix: `/api/v1/workspaces`

| Method   | Path   | Permission workspace | Chức năng                                  |
| -------- | ------ | -------------------- | ------------------------------------------ |
| `POST`   | `/`    | —                    | Tạo workspace; người gọi trở thành owner.  |
| `GET`    | `/`    | —                    | Liệt kê workspace của người dùng hiện tại. |
| `GET`    | `/:id` | `workspace.read`     | Xem workspace.                             |
| `PATCH`  | `/:id` | `workspace.update`   | Cập nhật workspace.                        |
| `DELETE` | `/:id` | `workspace.delete`   | Xóa workspace.                             |

### Thành viên, role và permission

Prefix: `/api/v1/workspaces/:workspaceId`

| Method  | Path                        | Permission workspace | Chức năng                           |
| ------- | --------------------------- | -------------------- | ----------------------------------- |
| `GET`   | `/permissions`              | `roles.read`         | Liệt kê các permission có thể gán.  |
| `GET`   | `/roles`                    | `roles.read`         | Liệt kê role của workspace.         |
| `POST`  | `/roles`                    | `roles.manage`       | Tạo custom role.                    |
| `PATCH` | `/roles/:roleId`            | `roles.manage`       | Cập nhật custom role.               |
| `GET`   | `/members`                  | `members.read`       | Liệt kê thành viên workspace.       |
| `POST`  | `/members`                  | `members.manage`     | Thêm user đã đăng ký vào workspace. |
| `PATCH` | `/members/:memberId/role`   | `members.manage`     | Đổi role thành viên.                |
| `PATCH` | `/members/:memberId/status` | `members.manage`     | Đổi trạng thái thành viên.          |

Permission hiện có: `workspace.read`, `workspace.update`, `workspace.delete`, `members.read`, `members.manage`, `roles.read`, `roles.manage`, `projects.read`, `projects.manage`, `workflow.manage`, `tasks.read`, `tasks.manage`, `activity.read`.

## Project và thành viên project

Prefix: `/api/v1/workspaces/:workspaceId/projects`

| Method   | Path                          | Permission workspace | Chức năng                                             |
| -------- | ----------------------------- | -------------------- | ----------------------------------------------------- |
| `POST`   | `/`                           | `projects.manage`    | Tạo project cùng workflow mặc định.                   |
| `GET`    | `/`                           | `projects.read`      | Liệt kê project người dùng hiện tại được tham gia.    |
| `GET`    | `/:projectId`                 | `projects.read`      | Xem project.                                          |
| `PATCH`  | `/:projectId`                 | `projects.manage`    | Cập nhật project.                                     |
| `DELETE` | `/:projectId`                 | `projects.manage`    | Xóa project.                                          |
| `GET`    | `/:projectId/members`         | `projects.read`      | Liệt kê thành viên project.                           |
| `POST`   | `/:projectId/members`         | `projects.manage`    | Thêm thành viên workspace đang hoạt động vào project. |
| `DELETE` | `/:projectId/members/:userId` | `projects.manage`    | Gỡ thành viên khỏi project.                           |
| `PATCH`  | `/:projectId/status`          | `workflow.manage`    | Chuyển project sang trạng thái workflow hợp lệ.       |

Khi tạo project, `name` và `key` là bắt buộc; key được chuẩn hóa chữ hoa và phải bắt đầu bằng chữ cái.

## Task, comment, dependency và work log

Prefix: `/api/v1/workspaces/:workspaceId/projects/:projectId/tasks`

| Method   | Path                                  | Permission workspace | Chức năng                                                                                                              |
| -------- | ------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/`                                   | `tasks.manage`       | Tạo task; có thể đặt estimate và task cha.                                                                             |
| `GET`    | `/`                                   | `tasks.read`         | Liệt kê task của project.                                                                                              |
| `GET`    | `/search`                             | `tasks.read`         | Tìm kiếm/lọc task có phân trang offset. Hỗ trợ query như `q`, `status`, `sprintId`, `parentTaskId`, `sortBy`, `limit`. |
| `GET`    | `/:taskId`                            | `tasks.read`         | Xem task.                                                                                                              |
| `PATCH`  | `/:taskId`                            | `tasks.manage`       | Cập nhật task hoặc estimate.                                                                                           |
| `DELETE` | `/:taskId`                            | `tasks.manage`       | Xóa task và work log của task đó.                                                                                      |
| `PATCH`  | `/:taskId/status`                     | `tasks.manage`       | Đổi hoặc mở lại trạng thái task.                                                                                       |
| `PATCH`  | `/:taskId/remaining`                  | `tasks.manage`       | Cập nhật thủ công thời gian còn lại sau khi estimate bị vượt.                                                          |
| `GET`    | `/:taskId/subtasks`                   | `tasks.read`         | Liệt kê task con.                                                                                                      |
| `GET`    | `/:taskId/dependencies`               | `tasks.read`         | Liệt kê dependency của task.                                                                                           |
| `POST`   | `/:taskId/dependencies`               | `tasks.manage`       | Thêm dependency.                                                                                                       |
| `DELETE` | `/:taskId/dependencies/:dependencyId` | `tasks.manage`       | Gỡ dependency.                                                                                                         |
| `GET`    | `/:taskId/comments`                   | `tasks.read`         | Liệt kê comment.                                                                                                       |
| `POST`   | `/:taskId/comments`                   | `tasks.manage`       | Tạo comment; hỗ trợ mention thành viên project.                                                                        |
| `POST`   | `/:taskId/work-logs`                  | `tasks.manage`       | Ghi thời gian đã làm.                                                                                                  |
| `GET`    | `/:taskId/work-logs`                  | `tasks.read`         | Liệt kê work log.                                                                                                      |
| `PATCH`  | `/:taskId/work-logs/:workLogId`       | `tasks.manage`       | Sửa ngày, số giờ hoặc mô tả work log của mình.                                                                         |
| `DELETE` | `/:taskId/work-logs/:workLogId`       | `tasks.manage`       | Xóa work log của mình.                                                                                                 |

Task mới cần `title` và `estimateHours`; các trường mô tả và `parentTaskId` là tùy chọn. Work log cần ngày dạng `YYYY-MM-DD` và số giờ.

## File đính kèm task (Cloudinary)

Prefix: `/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments`

| Method   | Path                     | Permission workspace | Chức năng                                                                         |
| -------- | ------------------------ | -------------------- | --------------------------------------------------------------------------------- |
| `POST`   | `/upload-signature`      | `tasks.manage`       | Tạo chữ ký upload Cloudinary có thời hạn; client dùng chữ ký để upload trực tiếp. |
| `POST`   | `/:attachmentId/confirm` | `tasks.manage`       | Xác minh upload Cloudinary đã hoàn thành và lưu metadata đính kèm.                |
| `GET`    | `/`                      | `tasks.read`         | Liệt kê file đính kèm cùng link tải có thời hạn.                                  |
| `DELETE` | `/:attachmentId`         | `tasks.manage`       | Xóa file trên Cloudinary và metadata tương ứng.                                   |

## Sprint

Prefix: `/api/v1/workspaces/:workspaceId/projects/:projectId/sprints`

| Method   | Path                       | Permission workspace | Chức năng                        |
| -------- | -------------------------- | -------------------- | -------------------------------- |
| `POST`   | `/`                        | `tasks.manage`       | Tạo sprint ở trạng thái planned. |
| `GET`    | `/`                        | `tasks.read`         | Liệt kê sprint của project.      |
| `GET`    | `/:sprintId`               | `tasks.read`         | Xem sprint.                      |
| `POST`   | `/:sprintId/start`         | `tasks.manage`       | Bắt đầu sprint planned.          |
| `POST`   | `/:sprintId/complete`      | `tasks.manage`       | Hoàn thành sprint active.        |
| `POST`   | `/:sprintId/cancel`        | `tasks.manage`       | Hủy sprint planned hoặc active.  |
| `GET`    | `/:sprintId/tasks`         | `tasks.read`         | Liệt kê task trong sprint.       |
| `POST`   | `/:sprintId/tasks`         | `tasks.manage`       | Gán task vào sprint.             |
| `DELETE` | `/:sprintId/tasks/:taskId` | `tasks.manage`       | Gỡ task khỏi sprint.             |

## Analytics và activity

### Analytics

Prefix: `/api/v1/workspaces/:workspaceId/projects/:projectId/analytics`; yêu cầu `tasks.read`.

| Method | Path                          | Chức năng                                                               |
| ------ | ----------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/summary`                    | Tổng hợp task và estimate của project.                                  |
| `GET`  | `/velocity?limit=6`           | Velocity của các sprint đã hoàn thành; `limit` từ 1 đến 24, mặc định 6. |
| `GET`  | `/cycle-time`                 | Cycle time từ lịch sử chuyển trạng thái task.                           |
| `GET`  | `/sprints/:sprintId/burndown` | Burndown sprint dựa trên estimate.                                      |

### Activity

`GET /api/v1/workspaces/:workspaceId/activity` — liệt kê hoạt động gần đây trong workspace; yêu cầu `activity.read`.

## Notifications

Prefix: `/api/v1/notifications`; các endpoint chỉ thao tác trên notification của người dùng đang đăng nhập.

| Method  | Path                    | Chức năng                               |
| ------- | ----------------------- | --------------------------------------- |
| `GET`   | `/`                     | Liệt kê notification.                   |
| `GET`   | `/unread-count`         | Lấy số notification chưa đọc.           |
| `PATCH` | `/read-all`             | Đánh dấu tất cả notification là đã đọc. |
| `PATCH` | `/:notificationId/read` | Đánh dấu một notification là đã đọc.    |

## Posts (tài nguyên mẫu)

Prefix: `/api/v1/posts` — các route cần Bearer token.

| Method   | Path   | Chức năng                            |
| -------- | ------ | ------------------------------------ |
| `GET`    | `/`    | Liệt kê post theo phân trang offset. |
| `GET`    | `/:id` | Lấy post theo UUID.                  |
| `POST`   | `/`    | Tạo post.                            |
| `PATCH`  | `/:id` | Cập nhật post.                       |
| `DELETE` | `/:id` | Xóa post.                            |

Đây là resource mẫu của boilerplate, không phải nghiệp vụ chính của WorkFlowHub.

## Mã lỗi phổ biến

- `400` — request không hợp lệ hoặc vi phạm điều kiện nghiệp vụ.
- `401` — thiếu hoặc access token không hợp lệ/hết hạn.
- `403` — đã đăng nhập nhưng không có quyền truy cập workspace/resource.
- `404` — không tìm thấy resource.
- `422` — dữ liệu request không đạt validation.
- `500` — lỗi không dự kiến phía server.

Schema cụ thể của từng DTO và response được công bố trong Swagger ở development.
