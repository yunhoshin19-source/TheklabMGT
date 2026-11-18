# THE KLAB 계약 금액·프로젝트 입금·변경이력 구현 노트

## 구현 상태
- **계약금액 / 월 청구금액 분리**: `contracts.total_amount` = 전체 계약 공급가액, `contracts.monthly_amount` = 유지보수 월 공급가액. 유형 유지보수인 계약에는 두 값과 `billing_day`가 별도 필수.
- **프로젝트 입금 예정 ↔ 실제 입금전표 연결**: `contract_schedules` 중 `schedule_type='receipt'` 항목에 `vouchers(type='receipt',status='approved')`를 만들고 `schedule_receipt_allocations`로 연결. 일정별 부분입금 다회 지원. 초과 입금 방지. 잠금으로 동시 수정 충돌 방지.
- **계약 변경이력 보존**: `contracts.revision` 낙관적 잠금, `contract_change_history`에 변경 전/후 JSON 및 처리자/시각 저장. 기존 기록은 DB 트리거로 수정/삭제 차단.
- **화면**: `contracts.html`에서 거래처, 계약 목록, 신규 등록, 수정, 일정, 수납 현황, 이력 조회 제공.
- **권한**: GET은 로그인 사용자, 저장과 입금전표 작성은 admin/manager/staff만. accountant는 읽기 전용.
- **지출증빙/계약서 파일 원본 업로드**는 미구현이며 실제 파일을 업로드하거나 GitHub에 커밋해서는 안 됩니다.

## DB 적용 (Docker 이전, 개발 DB에서)
1. PostgreSQL을 개발 환경에 준비.
2. 처음 구축하는 DB는 아래 순서대로 1회 실행:
   - `db/init/001_schema.sql`
   - `db/migrations/002_contract_master.sql`
   - `db/migrations/003_contract_financial_tracking.sql`
   - `api/schema.sql`
3. 기존 DB인 경우 **적용된 마이그레이션 확인 후** 미적용 파일만 순서대로 실행. 002/003은 재실행이 보장되지 않으므로 운영 환경에서 무작정 재실행하지 않습니다.
4. 초기 관리자는 `api/create-admin.js`를 이용해 생성합니다. 비밀번호는 쉘 환경변수로 전달하고 저장소 파일에 기록하지 마세요.
5. `api/`에서 `npm install`, `DATABASE_URL`, `API_PORT`, `COOKIE_SECURE` 설정 후 `npm start`. 실제 서비스에서는 HTTPS/Same-Origin 리버스 프록시로 `/api/*`를 API 서버에 전달해야 합니다. GitHub Pages 등 정적 호스팅만으로는 로그인/DB API가 작동하지 않습니다.

## API
| Method | Path | Purpose |
|---|---|---|
| GET/POST | /api/parties | 거래처 목록/생성 |
| GET/POST | /api/contracts | 계약 목록/생성 |
| PUT | /api/contracts/:id | 버전 검사 후 계약/일정 원자적 수정 및 이력 |
| GET | /api/contracts/:id/history | 계약 변경 전후 조회 |
| GET | /api/contracts/:id/schedules | 일정별 예정금액, 입금누계, 잔액 |
| POST | /api/schedules/:id/receipts | 입금전표 생성 + 일정 수납 배정 |

### 입금 규칙
- 실제 입금전표는 `type='receipt'`, `status='approved'`로 저장됩니다.
- `paid = SUM(schedule_receipt_allocations.amount)`.
- `remaining = schedule.amount - paid`. 0 미만을 허용하지 않습니다.
- `paid=0 → scheduled`, `0<paid<amount → partial`, `paid=amount → paid`.
- 이미 입금된 일정은 삭제 불가, 기존 입금액보다 낮게 예정금액 감소 불가, 날짜/유형 변경 불가.
- 예정 입금은 확정 매출액과 다르므로 손익에 중복 계상하지 않습니다.

## 검증 시나리오
- 유지보수 총 계약액 1,200만원 / 월 100만원 입력, 다시 조회해 별도 값 검증.
- 프로젝트 계약금 900만원 일정에 300만원 입금 → 누계 300만원 / 잔액 600만원 / 부분입금.
- 동일 일정에 600만원 입금 → 누계 900만원 / 잔액 0원 / 완납.
- 추가 1원 입금 시도 → HTTP 409 차단.
- 입금 연결 일정 삭제 또는 금액 899만원으로 변경 시도 → HTTP 409 차단.
- 계약기간·계약명 변경 → revision 1→2 증가 및 변경 전/후 이력 조회.
- 두 사용자가 같은 revision을 수정 시 두 번째 요청 HTTP 409.
- 세무사 계정으로 계약/일정 GET은 가능하지만 수정/입금 등록 요청은 HTTP 403.
- 비로그인 요청은 HTTP 401.

## 남은 개발 항목
- 계획 청구 자동 생성과 실제 청구전표 연결 및 미수금 원장
- 거래처 담당자 UI, 계약서/영수증의 인증된 스토리지 업로드
- 입금전표 취소·환불·정정, 은행 입금증빙, 세금계산서 상태관리
- 스키마 정리(기존 `organizations`의 단계적 이전), 마이그레이션 러너, CI 기반 통합 테스트
- 운영용 MFA, 세밀한 권한 및 감사보고, HTTPS, 백업 복원
