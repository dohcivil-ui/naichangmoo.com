"use client";

import { useState } from "react";
import { AppAssistant } from "@/components/platform/assistant-dock";
import type { AssistantScript } from "@/lib/estimeter-home-assistant";

/**
 * ผู้ช่วยบนหน้าแรก ESTIMETR — เสียบเข้าแผงผู้ช่วยกลาง ไม่ใช่วาดแผงของตัวเอง (IP-235)
 *
 * ต้นแบบที่เจ้าของงานเลือกวาดผู้ช่วยเป็นคอลัมน์ขวาในหน้า แต่แพลตฟอร์มมีช่องผู้ช่วยช่องเดียว
 * อยู่แล้วตาม IP-185 (`assistant-dock.tsx` เขียนกำกับว่า "ไม่ใช่เจ็ดช่องเจ็ดแบบ")
 * เจ้าของงานเคาะเมื่อ 2026-09-05 ให้ใช้แผงกลาง เนื้อในจึงถูก portal เข้าไปในนั้น
 * ผลพลอยได้คือมือถือได้แผ่นเลื่อนจากขอบล่างของแพลตฟอร์มมาเลย ไม่ต้องเขียนเอง
 *
 * **ไม่มีแบบจำลองอยู่ในไฟล์นี้** ปุ่มแต่ละปุ่มผูกกับคำตอบที่เขียนไว้แล้วใน
 * `estimeter-home-assistant.ts` กดปุ่มเดิมกี่ครั้งก็ได้คำตอบเดิม และไม่มีค่าใช้จ่ายต่อคลิก
 * ช่องพิมพ์ยังไม่มีในไฟล์นี้โดยตั้งใจ — ช่องที่พิมพ์ได้แต่ไม่มีใครตอบคือคำโกหกบนหน้าจอ
 */

type Line = { id: number; from: "bot" | "me"; text: string };

export function EstimeterHomeAssistant({ script }: { script: AssistantScript }) {
  const [thread, setThread] = useState<Line[]>(() =>
    script.greeting.map((text, index) => ({ id: index, from: "bot", text }))
  );
  const [asked, setAsked] = useState<string[]>([]);

  const remaining = script.prompts.filter((prompt) => !asked.includes(prompt.question));

  function ask(question: string, answer: string) {
    setThread((current) => [
      ...current,
      { id: current.length, from: "me", text: question },
      { id: current.length + 1, from: "bot", text: answer }
    ]);
    setAsked((current) => [...current, question]);
  }

  return (
    <AppAssistant
      title="ผู้ช่วยประมาณราคา"
      status={{ label: "ตอบจากบทที่เขียนไว้", tone: "ready" }}
    >
      <div className="eh__assist">
        <div className="eh__thread">
          {thread.map((line) => (
            <p key={line.id} className={line.from === "me" ? "eh__say eh__say--me" : "eh__say"}>
              {line.text}
            </p>
          ))}
        </div>

        {remaining.length > 0 ? (
          <div className="eh__chips">
            {remaining.map((prompt) => (
              <button
                className="eh__chip"
                type="button"
                key={prompt.question}
                onClick={() => ask(prompt.question, prompt.answer)}
              >
                {prompt.question}
              </button>
            ))}
          </div>
        ) : null}

        <div className="eh__scope">
          <strong>ผู้ช่วยตัวนี้ไม่ทำอะไร</strong>
          <ul>
            <li>ไม่ตัดสินตัวเลขแทนคุณ เสนอได้ แต่คนกดรับ</li>
            <li>ไม่เดาระยะที่แบบไม่ได้เขียน อ่านไม่ได้จะบอกว่าอ่านไม่ได้</li>
            <li>ไม่รับรอง BOQ หรือราคาทางวิชาชีพ</li>
            <li>เฟสนี้ตอบเฉพาะคำถามที่เตรียมไว้ ช่องพิมพ์ถามยังไม่เปิด</li>
          </ul>
        </div>
      </div>
    </AppAssistant>
  );
}
