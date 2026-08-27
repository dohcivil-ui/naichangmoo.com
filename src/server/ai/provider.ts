import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

/**
 * รอยต่อผู้ให้บริการแบบจำลอง
 *
 * มีอยู่เพราะเจ้าของงานตั้งโจทย์ว่ารายจ่ายต้องน้อยกว่ารายรับ และช่องว่างราคาระหว่างค่ายกว้างถึง
 * 60 เท่า (GPT-5-nano 0.04 บาทต่อครั้ง เทียบกับ Opus 5 ที่ 2.45 บาท) การผูกโค้ดไว้กับค่ายเดียว
 * จึงเท่ากับตัดสินใจเรื่องต้นทุนตลอดอายุแอปไปแล้วโดยไม่เคยวัดอะไรเลย
 *
 * DeepSeek, Kimi และ GPT ใช้ API รูปแบบเดียวกับ OpenAI ทั้งหมด จึงเขียน adapter แค่สองตัว
 * แล้วครอบได้ทุกค่าย ต่างกันแค่ baseURL กับชื่อ env ของกุญแจ
 *
 * ราคาที่บันทึกไว้ตรงนี้อ่านจากหน้าราคาทางการของแต่ละค่ายเมื่อ 2026-08-25 ไม่ใช่จากบล็อกสรุป
 * เพราะบล็อกที่ลองอ่านก่อนหน้าให้ตัวเลข DeepSeek ผิดไปสี่เท่า ราคาที่นี่ใช้เพื่อประเมิน
 * ค่าใช้จ่ายต่อครั้งเท่านั้น ไม่ได้ใช้เรียกเก็บเงินจริง
 */

export type ModelId =
  | "claude-opus-5"
  | "claude-sonnet-5"
  | "claude-haiku-4-5"
  | "deepseek-v4-pro"
  | "deepseek-v4-flash"
  | "kimi-k3"
  | "gpt-5.6-sol"
  | "gpt-5.4-mini"
  | "gpt-5-mini"
  | "gpt-5-nano";

type ProviderSpec = {
  label: string;
  vendor: string;
  kind: "anthropic" | "openai-compatible";
  apiModel: string;
  baseURL?: string;
  apiKeyEnv: string;
  /**
   * โหมดบังคับ JSON ที่ค่ายนั้นรองรับจริง
   *
   * `schema` คือส่งโครงสร้างไปให้เซิร์ฟเวอร์บังคับ ส่วน `object` คือบอกได้แค่ว่าขอ JSON
   * แล้วต้องเขียนโครงสร้างลงใน prompt เอง — DeepSeek ตอบ 400 เมื่อส่งแบบ schema
   * ทั้งที่เอกสารของเจ้าอื่นเขียนว่ารองรับ จึงต้องแยกไว้เป็นค่าของแต่ละค่าย ไม่ใช่เดาจากตระกูล API
   */
  jsonMode: "schema" | "object";
  /** ดอลลาร์ต่อหนึ่งล้าน token */
  inPerMTok: number;
  outPerMTok: number;
  note?: string;
};

export const MODELS: Record<ModelId, ProviderSpec> = {
  "claude-opus-5": {
    label: "Claude Opus 5", vendor: "Anthropic", kind: "anthropic",
    apiModel: "claude-opus-5", apiKeyEnv: "ANTHROPIC_API_KEY", jsonMode: "schema", inPerMTok: 5, outPerMTok: 25
  },
  "claude-sonnet-5": {
    label: "Claude Sonnet 5", vendor: "Anthropic", kind: "anthropic",
    apiModel: "claude-sonnet-5", apiKeyEnv: "ANTHROPIC_API_KEY", jsonMode: "schema", inPerMTok: 3, outPerMTok: 15,
    note: "ราคาโปร 2/10 ถึง 31 ส.ค. 2026 ที่บันทึกไว้คือราคาหลังโปรหมด"
  },
  "claude-haiku-4-5": {
    label: "Claude Haiku 4.5", vendor: "Anthropic", kind: "anthropic",
    apiModel: "claude-haiku-4-5", apiKeyEnv: "ANTHROPIC_API_KEY", jsonMode: "schema", inPerMTok: 1, outPerMTok: 5
  },
  "deepseek-v4-pro": {
    label: "DeepSeek V4 Pro", vendor: "DeepSeek", kind: "openai-compatible",
    apiModel: "deepseek-v4-pro", baseURL: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY", jsonMode: "object", inPerMTok: 1.32, outPerMTok: 3.96,
    note: "ราคาช่วงแพง ซึ่งตรงกับเวลาทำงานไทย 08:00-11:00 และ 13:00-17:00"
  },
  "deepseek-v4-flash": {
    label: "DeepSeek V4 Flash", vendor: "DeepSeek", kind: "openai-compatible",
    apiModel: "deepseek-v4-flash", baseURL: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY", jsonMode: "object", inPerMTok: 0.44, outPerMTok: 1.32,
    note: "ราคาช่วงแพง"
  },
  "kimi-k3": {
    label: "Kimi K3", vendor: "Moonshot", kind: "openai-compatible",
    apiModel: "kimi-k3", baseURL: "https://api.moonshot.ai/v1",
    apiKeyEnv: "MOONSHOT_API_KEY", jsonMode: "schema", inPerMTok: 3, outPerMTok: 15
  },
  "gpt-5.6-sol": {
    label: "GPT-5.6 Sol", vendor: "OpenAI", kind: "openai-compatible",
    apiModel: "gpt-5.6-sol", apiKeyEnv: "OPENAI_API_KEY", jsonMode: "schema", inPerMTok: 4, outPerMTok: 20,
    note: "ราคาโปรถึง 21 พ.ย. 2026"
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 mini", vendor: "OpenAI", kind: "openai-compatible",
    apiModel: "gpt-5.4-mini", apiKeyEnv: "OPENAI_API_KEY", jsonMode: "schema", inPerMTok: 0.75, outPerMTok: 4.5
  },
  "gpt-5-mini": {
    label: "GPT-5 mini", vendor: "OpenAI", kind: "openai-compatible",
    apiModel: "gpt-5-mini", apiKeyEnv: "OPENAI_API_KEY", jsonMode: "schema", inPerMTok: 0.25, outPerMTok: 2
  },
  "gpt-5-nano": {
    label: "GPT-5 nano", vendor: "OpenAI", kind: "openai-compatible",
    apiModel: "gpt-5-nano", apiKeyEnv: "OPENAI_API_KEY", jsonMode: "schema", inPerMTok: 0.05, outPerMTok: 0.4
  }
};

export const isModelId = (value: string): value is ModelId => value in MODELS;

/** แบบจำลองที่เรียกได้จริงตอนนี้ คือตัวที่มีกุญแจของค่ายนั้นอยู่ใน .env */
export const configuredModels = (): ModelId[] =>
  (Object.keys(MODELS) as ModelId[]).filter((id) => Boolean(process.env[MODELS[id].apiKeyEnv]));

export type Usage = { inputTokens: number; outputTokens: number };

/** ค่าใช้จ่ายเป็นบาท ใช้ประเมินเท่านั้น อัตราแลกเปลี่ยนตายตัวเพื่อให้เทียบกันได้ */
export const BAHT_PER_USD = 35;
export const costBaht = (id: ModelId, usage: Usage): number => {
  const spec = MODELS[id];
  const usd = (usage.inputTokens * spec.inPerMTok + usage.outputTokens * spec.outPerMTok) / 1_000_000;
  return usd * BAHT_PER_USD;
};

export type JsonResult<T> =
  | { ok: true; data: T; usage: Usage; costBaht: number; elapsedMs: number }
  | { ok: false; reason: "no_api_key" | "refused" | "unparsable" | "failed"; message: string };

type AskInput<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  /**
   * เพดานเวลาต่อคำขอหนึ่งครั้ง หน่วยมิลลิวินาที
   *
   * มีเพราะชั้นผู้ช่วยต้องสลับไปค่ายสำรองเมื่อค่ายหลักช้าเกินกว่าที่คนจะรอ และการรอด้วย
   * `Promise.race` ที่ชั้นบนไม่ได้ช่วยอะไร — คำขอเดิมยังวิ่งต่อจนจบและเงินยังจ่ายอยู่ดี
   * เพดานจึงต้องอยู่ที่ตัว SDK ซึ่งยกเลิกคำขอจริง ไม่ใช่แค่เลิกรอคำตอบ
   */
  timeoutMs?: number;
};

/**
 * ถามแบบจำลองแล้วบังคับให้ตอบตาม schema
 *
 * ทุกค่ารองรับ JSON Schema แต่คนละชื่อพารามิเตอร์ ตัวนี้จึงกลืนความต่างไว้ให้หมด
 * ผู้เรียกเห็นแค่ schema เดียวกับที่ใช้ตรวจผลลัพธ์ จะได้ไม่มีทางที่ prompt กับ schema หลุดจากกัน
 */
export async function askForJson<T>(id: ModelId, input: AskInput<T>, nowMs: number): Promise<JsonResult<T>> {
  const spec = MODELS[id];
  const key = process.env[spec.apiKeyEnv];
  if (!key) {
    return { ok: false, reason: "no_api_key", message: `ยังไม่ได้ตั้ง ${spec.apiKeyEnv} ใน .env` };
  }

  const maxTokens = input.maxTokens ?? 16000;

  try {
    if (spec.kind === "anthropic") {
      const client = new Anthropic({ apiKey: key });
      const response = await client.messages.create(
        {
          model: spec.apiModel,
          max_tokens: maxTokens,
          system: input.system,
          thinking: { type: "adaptive" },
          output_config: { format: { type: "json_schema", schema: z.toJSONSchema(input.schema) } },
          messages: [{ role: "user", content: input.user }]
        },
        input.timeoutMs ? { timeout: input.timeoutMs } : undefined
      );

      if (response.stop_reason === "refusal") {
        return { ok: false, reason: "refused", message: "แบบจำลองปฏิเสธคำขอนี้" };
      }

      const text = response.content.find((block) => block.type === "text");
      return finish(id, text && "text" in text ? text.text : "", input.schema, {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }, nowMs);
    }

    const client = new OpenAI({ apiKey: key, baseURL: spec.baseURL });
    const jsonSchema = z.toJSONSchema(input.schema);

    // ค่ายที่บังคับ schema ฝั่งเซิร์ฟเวอร์ไม่ได้ ต้องบอกโครงสร้างผ่าน prompt แทน
    // แล้วให้ zod เป็นด่านตรวจ ซึ่งเราตรวจอยู่แล้วทุกเส้นทาง
    const system =
      spec.jsonMode === "schema"
        ? input.system
        : `${input.system}

ตอบเป็น JSON ล้วนที่ตรงกับ schema นี้เท่านั้น ห้ามมีข้อความอื่นนอก JSON
${JSON.stringify(jsonSchema)}`;

    const response = await client.chat.completions.create(
      {
        model: spec.apiModel,
        max_completion_tokens: maxTokens,
        response_format:
          spec.jsonMode === "schema"
            ? { type: "json_schema", json_schema: { name: input.schemaName, strict: true, schema: jsonSchema } }
            : { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: input.user }
        ]
      },
      input.timeoutMs ? { timeout: input.timeoutMs } : undefined
    );

    return finish(id, response.choices[0]?.message?.content ?? "", input.schema, {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0
    }, nowMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // กุญแจผิดกับกุญแจไม่มีเป็นคนละอาการ และผู้ใช้แก้คนละวิธี จึงแยกให้ชัดตั้งแต่ตรงนี้
    if (/401|unauthor|invalid.*api.*key/i.test(message)) {
      return { ok: false, reason: "no_api_key", message: `${spec.apiKeyEnv} ใช้ไม่ได้ ตรวจค่าใน .env` };
    }
    return { ok: false, reason: "failed", message: `${spec.label} เรียกไม่สำเร็จ: ${message.slice(0, 160)}` };
  }
}

const finish = <T>(id: ModelId, raw: string, schema: z.ZodType<T>, usage: Usage, startedMs: number): JsonResult<T> => {
  const elapsedMs = Math.max(0, Date.now() - startedMs);
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparsable", message: "คำตอบไม่ใช่ JSON ที่อ่านได้" };
  }

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reason: "unparsable", message: `คำตอบไม่ตรง schema: ${parsed.error.issues[0]?.message ?? ""}` };
  }

  return { ok: true, data: parsed.data, usage, costBaht: costBaht(id, usage), elapsedMs };
};
