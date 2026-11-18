# THE KLAB MGT

내부 계약·회계관리 시스템. **현재 GitHub에서 개발 중이며 Docker 배포는 개발 완료 후 진행합니다.**

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
- 로그인 API와 계약 API는 서버 실행 및 Same-Origin reverse proxy가 있어야 동작합니다.
- 계약서/영수증 **실제 파일 업로드 및 저장은 미구현**입니다. 파일을 GitHub에 업로드하지 마세요.
- 프로젝트 입금 예정금액과 실제 입금액은 구분됩니다. 실제 입금전표만 수납 누계에 반영합니다.
- 금융 데이터와 개인정보를 개발/데모 환경에 입력하지 마세요.
- Docker 관련 파일은 추후 배포용 초안이며, 현재 앱/API가 완전히 통합된 Compose 구성이 아닙니다.

## 상세 개발 문서
[계약금액 분리 · 입금전표 연결 · 변경이력 및 테스트 시나리오](docs/contract-accounting-implementation.md)

## 남은 작업
계약 API 실행·DB 마이그레이션 검증, 청구/지급 자동화, 계약서 및 영수증 저장소, 세무사 다운로드, 회계 대시보드 실제 API 연결, 인증 강화, 테스트, 최종 Docker 패키징.
