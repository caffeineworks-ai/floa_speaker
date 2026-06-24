import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  FLOA_KV: KVNamespace;
}

interface SpeakerState {
  power: boolean;       // 전원
  playing: boolean;     // 재생 중 여부
  volume: number;       // 0 ~ 100
  playlistIndex: number; // 현재 재생목록 인덱스
  message: string;      // 가상 기기에 표시할 최근 메시지
  updatedAt: string;    // 마지막 변경 시각 (ISO)
}

const PLAYLISTS = [
  "목록 1: Chill Jazz",
  "목록 2: Sunset Pop",
];

const DEFAULT_STATE: SpeakerState = {
  power: true,
  playing: false,
  volume: 50,
  playlistIndex: 0,
  message: "",
  updatedAt: new Date().toISOString(),
};

// ─── MCP Agent ────────────────────────────────────────────────────────────────

export class FloaMCP extends McpAgent {
  server = new McpServer({ name: "floa-speaker", version: "1.0.0" });

  // KV는 fetch handler에서 env로 접근하므로, tool 핸들러에는 env를 직접 받을 수 없음.
  // McpAgent의 this.env로 접근한다.
  get kv(): KVNamespace {
    return (this.env as Env).FLOA_KV;
  }

  async getState(): Promise<SpeakerState> {
    const raw = await this.kv.get("state");
    if (!raw) return { ...DEFAULT_STATE };
    return JSON.parse(raw) as SpeakerState;
  }

  async setState(patch: Partial<SpeakerState>): Promise<SpeakerState> {
    const current = await this.getState();
    const next: SpeakerState = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.kv.put("state", JSON.stringify(next));
    return next;
  }

  async init() {

    // ── 0. 제품 정보 ──────────────────────────────────────────────────────────
    // 제품 정보는 floa_virtual.html 내 <script id="product-info"> 블록에서 관리합니다.
    // 학생들은 index.ts를 수정하지 않고 HTML 파일만 편집하면 됩니다.
    //
    // ✏️ 학생 수정 포인트: 아래 VIRTUAL_DEVICE_URL을 자신의 GitHub Pages 주소로 교체하세요.
    // 형식: https://{GitHub 유저명}.github.io/{레포명}/floa_virtual.html
    const VIRTUAL_DEVICE_URL =
      "https://YOUR_GITHUB_USERNAME.github.io/floa_speaker/floa_virtual.html";

    this.server.tool(
      "get_product_info",
      "FLOA 스피커의 제품 소개, 특징, 스펙 등 기본 정보를 반환합니다. 사용자가 제품에 대해 물어볼 때 호출하세요.",
      {},
      async () => {
        try {
          // GitHub Pages에서 가상 기기 HTML을 fetch해서 product-info 블록을 파싱
          const res = await fetch(VIRTUAL_DEVICE_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();

          // <script id="product-info" type="application/json"> ... </script> 추출
          const match = html.match(
            /<script[^>]+id="product-info"[^>]*>([\s\S]*?)<\/script>/
          );
          if (!match) throw new Error("product-info block not found");

          const info = JSON.parse(match[1].trim()) as {
            name: string;
            tagline: string;
            description: string;
            features: string[];
            spec?: Record<string, string>;
          };

          const lines = [
            `■ ${info.name}`,
            info.tagline,
            "",
            info.description,
          ];
          if (info.features?.length) {
            lines.push("", "주요 특징:");
            info.features.forEach((f) => lines.push(`  • ${f}`));
          }
          if (info.spec) {
            const entries = Object.entries(info.spec).filter(
              ([, v]) => v && !v.startsWith("TODO")
            );
            if (entries.length) {
              lines.push("", "스펙:");
              entries.forEach(([k, v]) => lines.push(`  • ${k}: ${v}`));
            }
          }

          return { content: [{ type: "text", text: lines.join("\n") }] };
        } catch (e) {
          // URL 미설정 또는 네트워크 오류 시 fallback 메시지
          return {
            content: [
              {
                type: "text",
                text:
                  "[제품 정보를 불러올 수 없습니다]\n" +
                  "index.ts의 VIRTUAL_DEVICE_URL이 올바른 GitHub Pages 주소인지 확인하세요.",
              },
            ],
          };
        }
      }
    );

    // ── 1. 상태 조회 ──────────────────────────────────────────────────────────
    this.server.tool(
      "get_speaker_state",
      "FLOA 스피커의 현재 상태(전원·재생·볼륨·재생목록)를 조회합니다.",
      {},
      async () => {
        const s = await this.getState();
        const text = [
          `전원: ${s.power ? "ON" : "OFF"}`,
          `재생 상태: ${s.playing ? "재생 중" : "정지"}`,
          `볼륨: ${s.volume}%`,
          `재생목록: ${PLAYLISTS[s.playlistIndex] ?? "알 수 없음"}`,
          `마지막 변경: ${s.updatedAt}`,
        ].join("\n");
        return { content: [{ type: "text", text }] };
      }
    );

    // ── 2. 전원 제어 ──────────────────────────────────────────────────────────
    this.server.tool(
      "set_power",
      "FLOA 스피커의 전원을 켜거나 끕니다. 전원을 끄면 재생도 자동으로 정지됩니다.",
      { on: z.boolean().describe("true = 전원 ON, false = 전원 OFF") },
      async ({ on }) => {
        const patch: Partial<SpeakerState> = { power: on };
        if (!on) patch.playing = false; // 전원 OFF → 재생 중지
        patch.message = on ? "전원이 켜졌습니다." : "전원이 꺼졌습니다.";
        await this.setState(patch);
        return { content: [{ type: "text", text: patch.message }] };
      }
    );

    // ── 3. 재생 / 일시정지 ────────────────────────────────────────────────────
    this.server.tool(
      "set_playback",
      "FLOA 스피커의 재생을 시작하거나 일시정지합니다. 전원이 꺼져 있으면 재생할 수 없습니다.",
      { playing: z.boolean().describe("true = 재생, false = 일시정지") },
      async ({ playing }) => {
        const s = await this.getState();
        if (!s.power && playing) {
          return { content: [{ type: "text", text: "전원이 꺼져 있어 재생할 수 없습니다. 먼저 전원을 켜주세요." }] };
        }
        const msg = playing ? "재생을 시작합니다." : "재생을 일시정지합니다.";
        await this.setState({ playing, message: msg });
        return { content: [{ type: "text", text: msg }] };
      }
    );

    // ── 4. 볼륨 설정 ──────────────────────────────────────────────────────────
    this.server.tool(
      "set_volume",
      "FLOA 스피커의 볼륨을 설정합니다. 0(무음)~100(최대) 사이의 값을 지정하세요.",
      { volume: z.number().int().min(0).max(100).describe("볼륨 값 (0~100)") },
      async ({ volume }) => {
        const msg = `볼륨을 ${volume}%로 설정했습니다.`;
        await this.setState({ volume, message: msg });
        return { content: [{ type: "text", text: msg }] };
      }
    );

    // ── 5. 볼륨 증감 (상대값) ─────────────────────────────────────────────────
    this.server.tool(
      "adjust_volume",
      "현재 볼륨에서 상대적으로 올리거나 내립니다. '볼륨 좀 높여줘', '조금 줄여줘' 같은 요청에 사용하세요.",
      { delta: z.number().int().describe("볼륨 변화량. 양수 = 올리기, 음수 = 낮추기. 예: 10 또는 -10") },
      async ({ delta }) => {
        const s = await this.getState();
        const next = Math.max(0, Math.min(100, s.volume + delta));
        const dir = delta > 0 ? "올렸습니다" : "낮췄습니다";
        const msg = `볼륨을 ${Math.abs(delta)} 만큼 ${dir}. (현재: ${next}%)`;
        await this.setState({ volume: next, message: msg });
        return { content: [{ type: "text", text: msg }] };
      }
    );

    // ── 6. 재생목록 변경 ──────────────────────────────────────────────────────
    this.server.tool(
      "set_playlist",
      `재생목록을 변경합니다. 사용 가능한 목록: ${PLAYLISTS.map((n, i) => `${i}=${n}`).join(", ")}`,
      { index: z.number().int().min(0).max(PLAYLISTS.length - 1).describe("재생목록 인덱스 (0부터 시작)") },
      async ({ index }) => {
        const name = PLAYLISTS[index];
        const msg = `재생목록을 "${name}"으로 변경했습니다.`;
        await this.setState({ playlistIndex: index, message: msg });
        return { content: [{ type: "text", text: msg }] };
      }
    );

    // ── 7. 다음 / 이전 재생목록 ───────────────────────────────────────────────
    this.server.tool(
      "change_playlist",
      "현재 재생목록에서 다음 또는 이전 목록으로 이동합니다.",
      { direction: z.enum(["next", "prev"]).describe("이동 방향: 'next' 또는 'prev'") },
      async ({ direction }) => {
        const s = await this.getState();
        const next = direction === "next"
          ? (s.playlistIndex + 1) % PLAYLISTS.length
          : (s.playlistIndex - 1 + PLAYLISTS.length) % PLAYLISTS.length;
        const name = PLAYLISTS[next];
        const msg = `재생목록을 "${name}"으로 변경했습니다.`;
        await this.setState({ playlistIndex: next, message: msg });
        return { content: [{ type: "text", text: msg }] };
      }
    );

    // ── 8. 메시지 전송 ────────────────────────────────────────────────────────
    this.server.tool(
      "send_message",
      "FLOA 가상 기기의 Push Messages 패널에 메시지를 표시합니다. 알림, 인사, 공지 등을 전송할 때 사용하세요.",
      { message: z.string().min(1).max(200).describe("기기에 표시할 메시지 텍스트") },
      async ({ message }) => {
        await this.setState({ message });
        return { content: [{ type: "text", text: `메시지를 전송했습니다: "${message}"` }] };
      }
    );
  }
}

// ─── Fetch Handler ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // MCP 엔드포인트 — claude.ai 커넥터가 연결하는 경로
    if (url.pathname === "/mcp") {
      return FloaMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // 가상 기기 HTML이 2초마다 폴링하는 상태 엔드포인트
    if (url.pathname === "/state") {
      // OPTIONS preflight 처리
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      const raw = await env.FLOA_KV.get("state");
      return new Response(raw ?? "{}", {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
