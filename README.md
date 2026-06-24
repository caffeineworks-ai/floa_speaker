# floa-speaker MCP

FLOA 가상 스피커를 Claude ↔ MCP ↔ 브라우저 방식으로 원격 조작하는 프로젝트입니다.

## 구조

```
Claude (claude.ai)
   │  MCP tool 호출
   ▼
Cloudflare Workers  (/mcp)
   │  상태를 KV에 저장
   ▼
Cloudflare KV  ("state" 키)
   ▲  2초마다 폴링
   │
브라우저 (floa_virtual.html)
```

## 제공 MCP Tools

| Tool | 설명 |
|---|---|
| `get_speaker_state` | 현재 상태 조회 |
| `set_power` | 전원 ON/OFF |
| `set_playback` | 재생 / 일시정지 |
| `set_volume` | 볼륨 절댓값 설정 (0~100) |
| `adjust_volume` | 볼륨 상대 증감 (+/-) |
| `set_playlist` | 재생목록 인덱스로 변경 |
| `change_playlist` | 다음/이전 재생목록 이동 |
| `send_message` | Push Messages 패널에 메시지 전송 |

## 배포 절차

### 1. KV 네임스페이스 생성
```bash
npx wrangler kv namespace create FLOA_KV
```
출력된 `id` 값을 `wrangler.toml`의 `id = "KV_네임스페이스_ID"` 부분에 붙여넣기.

### 2. GitHub 리포지토리 생성 및 Secrets 등록
- `CF_API_TOKEN`: Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers
- `CF_ACCOUNT_ID`: Cloudflare → Workers & Pages → 우측 Account ID

### 3. main 브랜치에 push → 자동 배포
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR/REPO.git
git push -u origin main
```

### 4. 가상 기기 HTML 수정 (✏️ 핵심 수정 파일)

`floa_virtual.html` 에서 두 곳을 수정합니다.

**① 제품 정보** — `<script id="product-info">` 블록을 팀 기획에 맞게 편집
```json
{
  "name": "FLOA",
  "tagline": "물 위에 떠서 음악을 재생하는 스피커입니다.",
  "description": "...",
  "features": ["IPX7 방수 등급", "..."],
  "spec": { "battery": "8시간", "price": "79,000원" }
}
```
Claude가 제품 정보를 물어보면 이 JSON을 읽어서 답합니다.

**② Worker URL** — 자신의 Cloudflare 배포 주소로 교체
```javascript
const MCP_WORKER_URL = "https://floa-speaker.YOUR_ACCOUNT.workers.dev";
```

### 5. index.ts에서 GitHub Pages URL 설정

`src/index.ts` 상단의 `VIRTUAL_DEVICE_URL`을 자신의 GitHub Pages 주소로 교체:
```typescript
const VIRTUAL_DEVICE_URL =
  "https://YOUR_GITHUB_USERNAME.github.io/floa_speaker/floa_virtual.html";
```
> GitHub Pages 활성화: 레포 Settings → Pages → Branch: main, folder: / (root)

### 6. claude.ai 커넥터 연결
Settings → Integrations → Add custom integration
URL: `https://floa-speaker.YOUR_ACCOUNT.workers.dev/mcp`

## 사용 예시 (Claude에게 말하기)

- "floa 스피커 전원 켜줘"
- "볼륨 30으로 낮춰줘"
- "볼륨 조금 높여줘"
- "Sunset Pop으로 바꿔줘"
- "재생 시작해"
- "지금 상태 알려줘"
- "스피커에 '안녕하세요!' 메시지 보내줘"
