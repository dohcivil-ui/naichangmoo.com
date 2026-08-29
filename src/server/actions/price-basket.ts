"use server";

import { headers } from "next/headers";
import { getPlatformSessionUser } from "@/server/auth-session";
import {
  dropLine,
  pickLine,
  readBasket,
  sendBasketToProject,
  setLineQuantity,
  type BasketResult,
  type BasketView,
  type PickedLineInput,
  type SendToProjectResult
} from "@/server/price-basket";

/**
 * ประตูของรายการราคาที่หยิบไว้ (IP-163)
 *
 * บางที่สุดเท่าที่จะบางได้ ตามแบบของ `actions/assistant.ts` — อ่านผู้ใช้จาก session แล้วส่งต่อ
 * ทุกด่านอยู่ในชั้นล่าง ไม่มีข้อตัดสินใจใดเกิดที่นี่ เพราะสิ่งที่หน้าจอเรียกได้ คนก็เรียกตรงได้
 */

const viewer = async () => (await getPlatformSessionUser(await headers()))?.id ?? null;

export async function loadPriceBasket(): Promise<BasketView> {
  return readBasket(await viewer());
}

/** `unitSatang` เดินทางเป็นสตริง เพราะ bigint ข้ามรอยต่อ server action ไม่ได้ */
export type PickLineRequest = Omit<PickedLineInput, "unitSatang"> & { unitSatang: string };

export async function pickPriceLine(request: PickLineRequest): Promise<BasketResult> {
  return pickLine(await viewer(), { ...request, unitSatang: BigInt(request.unitSatang) });
}

export async function dropPriceLine(lineKey: string): Promise<BasketView> {
  return dropLine(await viewer(), lineKey);
}

export async function setPriceLineQuantity(lineKey: string, quantity: number): Promise<BasketView> {
  return setLineQuantity(await viewer(), lineKey, quantity);
}

export async function sendPriceBasketToProject(projectId: string, name?: string): Promise<SendToProjectResult> {
  return sendBasketToProject(await viewer(), projectId, { name });
}

export type BasketTargetProject = { id: string; name: string };

/**
 * โครงการที่ส่งชุดราคาเข้าไปได้
 *
 * ขอบเขตองค์กรอยู่ใน `listProjects` อยู่แล้ว ที่นี่จึงแค่หาว่าผู้ใช้อยู่องค์กรไหน
 * คนที่ยังไม่เคยมีองค์กรได้รายการว่าง ไม่ใช่ error เพราะเขายังไม่เคยสร้างโครงการเลย
 */
export async function listBasketTargetProjects(): Promise<BasketTargetProject[]> {
  const userId = await viewer();
  if (!userId) return [];

  const { getDb } = await import("@/db");
  const { readMembershipOrganization } = await import("@/server/app-access");
  const { listProjects } = await import("@/server/estimeter/project-repository");

  const organizationId = await readMembershipOrganization(getDb(), userId);
  if (!organizationId) return [];
  return (await listProjects(organizationId)).map((project) => ({ id: project.id, name: project.name }));
}
