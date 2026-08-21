import { StatusConsole } from "@/components/project-status/status-console";
import { readProjectStatus } from "@/server/project-status";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const initial = await readProjectStatus();
  return <main className="site-shell roadmap-page"><div className="container"><Link className="back-link" href="/">← กลับหน้า Landing</Link><StatusConsole initial={initial} /></div></main>;
}
