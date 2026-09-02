import { notFound } from "next/navigation";
import { AppShell } from "@/components/platform/app-shell";
import { ESTIMETR_APP_SLUG } from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";

/**
 * Shared chrome only. The session and entitlement checks live in each page, because a
 * layout is not a security boundary: Next.js still executes the page it wraps.
 */
export default function EstimeterLayout({ children }: { children: React.ReactNode }) {
  const app = platformApps.find((item) => item.slug === ESTIMETR_APP_SLUG);
  if (!app) notFound();

  return <AppShell app={app}>{children}</AppShell>;
}
