/* eslint-disable @next/next/no-img-element */

/** LUXE HAVEN logo mark (transparent background, gold). Designed for dark headers. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo-icon.png"
      alt="LUXE HAVEN"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="object-contain shrink-0"
    />
  );
}

export const BRAND_NAME = "LUXE HAVEN";
