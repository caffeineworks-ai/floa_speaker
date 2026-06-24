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
| `get_product_info` | 제품 정보 조회 |
| `get_speaker_state` | 현재 상태 조회 |
| `set_power` | 전원 ON/OFF |
| `set_playback` | 재생 / 일시정지 |
| `set_volume` | 볼륨 절댓값 설정 (0~100) |
| `adjust_volume` | 볼륨 상대 증감 (+/-) |
| `set_playlist` | 재생목록 인덱스로 변경 |
| `change_playlist` | 다음/이전 재생목록 이동 |
| `send_message` | Push Messages 패널에 메시지 전송 |

## 시작하기

### 1. 브랜드 웹페이지 제작 (✏️ 핵심 수정 파일)

`index.html`을 팀의 브랜드 페이지로 교체하세요. 현재는 placeholder가 들어 있습니다.

GitHub Pages 주소: `https://{GitHub 유저명}.github.io/floa_speaker/`

**제품 정보도 함께 수정** — `floa_virtual.html` 안의 `<script id="product-info">` 블록을 팀 기획에 맞게 편집하세요.
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

### 2. GitHub Pages 활성화

레포 Settings → Pages → Branch: main, folder: / (root)

`floa_virtual.html` 접속 주소:
`https://{GitHub 유저명}.github.io/floa_speaker/floa_virtual.html`

### 3. claude.ai 커넥터 연결

Settings → Integrations → Add custom integration
URL: `https://floa-speaker.typica-918.workers.dev/mcp`

## 사용 예시 (Claude에게 말하기)

- "floa 스피커 전원 켜줘"
- "볼륨 30으로 낮춰줘"
- "볼륨 조금 높여줘"
- "Sunset Pop으로 바꿔줘"
- "재생 시작해"
- "지금 상태 알려줘"
- "스피커에 '안녕하세요!' 메시지 보내줘"
- "이 제품 어떤 제품이야?"
