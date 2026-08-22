import Image from "next/image";
import { visualAssetUrl } from "@/lib/visual-assets";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const key = compact ? "brand_mark" : "brand_wordmark";
  const alt = compact ? "ตราสัญลักษณ์ NM นายช่างหมู" : "นายช่างหมู — CIVIL APPS ASSISTANT";

  return (
    <Image
      className={compact ? "brand-logo__mark" : "brand-logo__wordmark"}
      src={visualAssetUrl(key)}
      alt={alt}
      width={compact ? 370 : 1168}
      height={compact ? 308 : 334}
      priority
    />
  );
}
