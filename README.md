# THE KLAB MGT

내부 계약·회계관리 시스템. **현재 GitHub에서 개발 중이며 Docker 배포는 개발 완료 후 진행합니다.**

## 공개 UI 프로토타입 (기능 시연용)

**접속:** https://yunhoshin19-source.github.io/TheklabMGT/

GitHub Pages는 `preview/` 폴더만 배포합니다. `preview/index.html`은 데모 로그인 진입 화면이며, 로그인 버튼은 **실제 사용자 인증이 아니라 브라우저 내 샘플 진입**입니다. 비밀번호와 실무 데이터는 입력하지 마세요.

프리뷰는 독립 HTML 페이지로 나누었습니다.

- `preview/index.html`: 로그인(데모 진입, 초기화)
- `preview/dashboard.html`: 계약 시작·종료, 정기 청구, 프로젝트 입금, 전표 달력
- `preview/parties.html`: 사업자/개인 거래처 등록·수정
- `preview/contracts.html`: 계약 등록·수정, 총액/월 청구액 분리, 일정별 실제 입금·부분입금·변경이력
- `preview/vouchers.html`: 청구·입금·비용·지급 전표 등록 및 수정
- `preview/tax.html`: 비용 증빙 현황·미첨부 점검·CSV
- `preview/reports.html`: 확정 전표 관리손익/현금흐름·CSV
- `preview/users.html`: 샘플 사용자/권한/상태 관리

공통 상태는 `preview/demo.js`가 브라우저 localStorage에 저장하며, 페이지는 `preview/pages/*.js`로 독립됩니다. 샘플 초기화는 로그인 화면에서 수행합니다. 실제 로그인 세션, 운영 PostgreSQL, 계약서 원본 및 영수증 파일 저장 기능을 제공하지 않습니다. 실제 API/DB 개발 코드는 저장소 루트의 `api/`, `db/`, `*.html`과 별도입니다.

## 실제 개발용 페이지 경로
- `index.html`은 로그인 진입 페이지
- `dashboard.html`은 로그인 후 보호되는 대시보드
- `contracts.html`, `users.html`은 인증 페이지
- `api/server.js`는 GET / 요청 시 index 로그인 화면을 제공합니다.

## 페이지별 퍼블리싱 구조

각 화면을 독립 HTML로 유지합니다. 공통 스타일/내비게이션만 재사용하고 업무별 JavaScript는 별도 파일입니다.

```text
index.html                 # 로그인 첫 화면
login.html                 # 호환 로그인 화면
dashboard.html             # 달력 대시보드
users.html                 # 사용자 관리
contracts.html             # 계약/거래처 관리
assets/
  css/
    common.css             # 디자인 토큰, 공통 반응형·모바일 내비게이션
    pages/
      index.css
      login.css
      users.css
      contracts.css
  js/
    common.js              # 공통 메뉴, 페이지 이동, 접근성
    pages/
      index.js
      login.js
      users.js
      contracts.js
```

- 각 화면의 UI 수정은 해당 `assets/css/pages/*.css` 및 `assets/js/pages/*.js`에 적용합니다.
- 공통 버튼/색상/모바일 메뉴 규칙만 `assets/css/common.css`에 적용합니다.
- 모바일에서는 공통 하단 메뉴를 사용하고 대시보드 달력은 가로 스크롤됩니다.
- 서버 인증/DB API가 없는 정적 호스팅에서는 로그인 후 화면을 사용할 수 없습니다.
- 코드 참조 경로를 GitHub에서 확인했지만, 실제 브라우저 반응형/로그인 동작 통합 테스트는 별도로 필요합니다.

## 로그인 및 PostgreSQL 통합 테스트 (2026-11-18)

GitHub Actions `API + PostgreSQL Integration`이 PostgreSQL 16 컨테이너를 만들고, 스키마를 적용하고, 실제 웹서버/API를 실행해 아래 시나리오를 확인합니다:

- DB 연결 확인 (`GET /api/health`)
- 비로그인 계약 페이지 접근 차단
- 관리자 계정 비밀번호 검증 및 DB 세션 쿠키 발급
- 사용자 생성/조회
- 거래처 생성과 유지보수 총계약금액·월금액 별도 저장
- 프로젝트 부분입금/완납, 초과입금 금지
- 계약 수정 이력과 동시 변경 버전 충돌
- 로그아웃 세션 무효화

실행 결과: https://github.com/yunhoshin19-source/TheklabMGT/actions/runs/44244590641

### Docker 없이 개발용 서버 실행

개발용 PostgreSQL 16 DB를 준비하고 다음 SQL을 순서대로 실행:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/init/001_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_contract_master.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_contract_financial_tracking.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/schema.sql
```

```bash
cd api
npm install
# DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD 값을 안전한 환경변수로 설정
npm run create-admin
# 로컬 HTTP 개발용으로만 COOKIE_SECURE=false
npm start
```

이제 `http://127.0.0.1:3000/login.html`에서 로그인하고 계약관리와 사용자관리 페이지로 이동할 수 있습니다. 실제 업무 데이터를 사용하지 말고 테스트 계정/샘플 거래처만 사용하세요. 운영 환경은 TLS(HTTPS), 보안 쿠키, 계정 권한, DB 백업, 비밀정보 저장소를 별도로 구성해야 합니다.

**중요:** GitHub Pages는 공개 UI 프리뷰 전용입니다. 로그인/DB 연동은 Pages에서 제공되지 않습니다. 상시 서버와 운영 DB 배포는 아직 진행하지 않았으며 Docker 도입도 개발 완료 후로 유지합니다.

## 최근 구현
- 사용자 로그인/관리: `login.html`, `users.html`, `api/server.js`
- 계약·거래처 마스터: `contracts.html`, `api/contracts.js`
- 유지보수: 전체 계약금액과 월 청구금액을 독립적으로 저장
- 프로젝트: 입금예정 일정과 실제 입금전표 연결, 부분입금/완납/잔액 계산
- 계약 수정 이력: 이전/이후 JSON 및 버전 충돌 감지
- 달력형 회계 대시보드: `index.html` (**기존 전표 화면은 데모 localStorage이며 API와 아직 연결되지 않음**)

## DB 스키마 적용 순서
1. `db/init/001_schema.sql`
2. `db/migrations/002_contract_master.sql`
3. `db/migrations/003_contract_financial_tracking.sql`
4. `api/schema.sql`

기존 데이터가 있는 DB에서는 적용 이력을 먼저 확인하고 미적용 마이그레이션만 실행하세요. DB 서버는 아직 생성·배포하지 않았으며 위 스키마는 Git에 준비한 코드입니다.

## 개발 상태 및 제한
- 계약 UI는 인증 API와 PostgreSQL 연동을 전제로 구현했으며, 배포된 실행 환경에서 아직 통합 검증하지 않았습니다.
- 개발용 Node 서버가 HTML과 API를 같은 로컬 주소에서 제공합니다. 운영용 외부 공개 시 HTTPS 리버스 프록시와 별도 접근통제가 필요합니다.
- 계약서/영수증 **실제 파일 업로드 및 저장은 미구현**입니다. 파일을 GitHub에 업로드하지 마세요.
- 프로젝트 입금 예정금액과 실제 입금액은 구분됩니다. 실제 입금전표만 수납 누계에 반영합니다.
- 금융 데이터와 개인정보를 개발/데모 환경에 입력하지 마세요.
- Docker 관련 파일은 추후 배포용 초안이며, 현재 앱/API가 완전히 통합된 Compose 구성이 아닙니다.

## 상세 개발 문서
[계약금액 분리 · 입금전표 연결 · 변경이력 및 테스트 시나리오](docs/contract-accounting-implementation.md)

## 남은 작업
계약 API 실행·DB 마이그레이션 검증, 청구/지급 자동화, 계약서 및 영수증 저장소, 세무사 다운로드, 회계 대시보드 실제 API 연결, 인증 강화, 테스트, 최종 Docker 패키징.
