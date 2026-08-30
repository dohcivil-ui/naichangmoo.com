/**
 * ความเหมือนของชื่อรายการ — TF-IDF กับ cosine similarity
 *
 * **ทำไมต้องเป็น TF-IDF ไม่ใช่การนับคำที่ตรงกันเฉย ๆ** ชื่อรายการก่อสร้างมีคำที่โผล่แทบทุก
 * บรรทัดอยู่เต็มไปหมด — คอนกรีต, งาน, ขนาด, เหล็ก — คำพวกนี้ตรงกันแล้วแทบไม่ได้บอกอะไร
 * ส่วนคำที่บอกจริง ๆ คือคำที่หายาก เช่น **240** หรือ **ฐานราก** TF-IDF ให้น้ำหนักตามความหายาก
 * ในบัญชีทั้งเล่มพอดี คำที่มีอยู่ทุกบรรทัดจะได้น้ำหนักเกือบศูนย์เอง โดยไม่ต้องมีใครมานั่งเขียน
 * รายชื่อคำที่ให้มองข้าม ซึ่งเป็นรายการที่ไม่มีวันครบ
 *
 * **ภาษาไทยไม่มีช่องว่างระหว่างคำ** ไฟล์นี้จึงไม่แกล้งทำเป็นตัดคำไทย แต่ใช้ n-gram ระดับ
 * ตัวอักษรกับช่วงที่เป็นภาษาไทย ซึ่งเป็นวิธีมาตรฐานสำหรับภาษาที่เขียนติดกัน การอ้างว่า
 * ตัดคำไทยได้ทั้งที่ใช้ตัวตัดหยาบ ๆ จะทำให้คนเชื่อคะแนนมากกว่าที่มันควรได้รับ
 *
 * **ตัวเลขเป็น token ของตัวเอง** เพราะในงานก่อสร้าง ตัวเลขในชื่อคือชั้นคุณภาพและขนาด
 * คอนกรีต 240 กับ 280 ต่างกันคนละราคา การปล่อยให้ตัวเลขจมไปกับตัวอักษรรอบข้าง
 * คือการทิ้งสัญญาณที่ชัดที่สุดที่ชื่อรายการมี
 */

/** ความยาวของ n-gram สำหรับช่วงภาษาไทย สามตัวอักษรจับคำสั้นอย่าง "ราก" ได้ทั้งคำ */
const THAI_GRAM = 3;

const THAI_RUN = /[฀-๿]+/g;
const LATIN_RUN = /[a-zA-Z]+/g;
const NUMBER_RUN = /\d+(?:\.\d+)?/g;

/**
 * แตกชื่อรายการเป็น token ที่เทียบกันได้
 *
 * คืน token ซ้ำได้ เพราะจำนวนครั้งที่คำโผล่คือส่วน term frequency ของ TF-IDF
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];

  for (const match of text.matchAll(NUMBER_RUN)) {
    // ตัดศูนย์ท้ายทศนิยมทิ้ง เพื่อให้ 6.00 กับ 6 เป็น token เดียวกัน
    //
    // นำหน้าด้วย `n:` ไม่ใช่ `#` เพราะ `#240` หน้าตาเหมือนเลขสีฮาร์ดโค้ดทุกประการ
    // แล้วรั้วสีของ ADR 0021 จับได้จริงตอนรันเทสต์ · ด่านทำงานถูกแล้ว ตัวที่ควรเปลี่ยนคือชื่อ
    tokens.push(`n:${String(Number(match[0]))}`);
  }

  for (const match of text.matchAll(LATIN_RUN)) {
    tokens.push(match[0].toLowerCase());
  }

  for (const match of text.matchAll(THAI_RUN)) {
    const run = match[0];
    if (run.length <= THAI_GRAM) {
      tokens.push(run);
      continue;
    }
    for (let start = 0; start + THAI_GRAM <= run.length; start += 1) {
      tokens.push(run.slice(start, start + THAI_GRAM));
    }
  }

  return tokens;
}

export type IdfIndex = ReadonlyMap<string, number>;

/**
 * น้ำหนักความหายากของแต่ละ token คิดจากทั้งกองที่กำลังเทียบกัน
 *
 * ใช้สูตรที่บวกหนึ่งทั้งเศษและส่วน (smoothed idf) เพื่อไม่ให้ token ที่โผล่ทุกเอกสาร
 * ได้น้ำหนักศูนย์เป๊ะ ซึ่งจะทำให้บรรทัดที่มีแต่คำสามัญได้คะแนนเป็น 0 หารด้วยศูนย์
 */
export function buildIdf(documents: readonly (readonly string[])[]): IdfIndex {
  const documentCount = documents.length;
  const seenIn = new Map<string, number>();

  for (const document of documents) {
    for (const token of new Set(document)) {
      seenIn.set(token, (seenIn.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, count] of seenIn) {
    idf.set(token, Math.log((documentCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

function weightedVector(tokens: readonly string[], idf: IdfIndex): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const token of tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);

  const vector = new Map<string, number>();
  for (const [token, count] of frequency) {
    // token ที่ไม่เคยเห็นในกองอ้างอิงถือว่าหายากที่สุด จึงให้น้ำหนักเท่ากับกรณีโผล่ครั้งเดียว
    vector.set(token, count * (idf.get(token) ?? Math.log(2) + 1));
  }
  return vector;
}

/**
 * คะแนนความเหมือนระหว่าง 0 ถึง 1 · 1 คือชุด token เหมือนกันทุกประการ
 *
 * เอกสารว่างได้ 0 เสมอ ไม่ใช่ NaN — ชื่อที่ว่างเปล่าไม่เหมือนอะไรเลย รวมทั้งไม่เหมือนกันเอง
 */
export function cosineSimilarity(left: readonly string[], right: readonly string[], idf: IdfIndex): number {
  if (left.length === 0 || right.length === 0) return 0;

  const a = weightedVector(left, idf);
  const b = weightedVector(right, idf);

  let dot = 0;
  for (const [token, weight] of a) {
    const other = b.get(token);
    if (other !== undefined) dot += weight * other;
  }
  if (dot === 0) return 0;

  const norm = (vector: Map<string, number>) =>
    Math.sqrt([...vector.values()].reduce((sum, weight) => sum + weight * weight, 0));

  return dot / (norm(a) * norm(b));
}
