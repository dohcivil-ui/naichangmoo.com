import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { StatusConsole } from "@/components/project-status/status-console";
import { readProjectStatus } from "@/server/project-status";

export const dynamic = "force-dynamic";

/**
 * This was the only page in the product with no header, and it is linked from the footer of every
 * other one — so it was the easiest place to land and the hardest to leave. It carried a hand-rolled
 * "← กลับหน้า Landing" instead, which is both English jargon in a Thai interface and a fifth name
 * for a destination that now has one. The header carries the way back like everywhere else.
 */
export default async function RoadmapPage() {
  const initial = await readProjectStatus();
  return (
    <main className="site-shell roadmap-page">
      <SiteHeader />
      <div className="roadmap-page__body">
        <div className="container"><StatusConsole initial={initial} /></div>
      </div>
      <PlatformFooter />
    </main>
  );
}
