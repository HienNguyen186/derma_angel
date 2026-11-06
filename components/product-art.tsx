"use client";

import type { Product } from "@/lib/store";

const positions: Record<string, [number, number]> = {
  glitter: [59, 383], "cute-paws": [217, 383], hologram: [370, 383],
  panda: [116, 663], kitties: [291, 663],
};

export function ProductArt({ product, large = false }: { product: Pick<Product, "id" | "name" | "image">; large?: boolean }) {
  const position = positions[product.id];
  return <div className={`product-art ${large ? "product-art-large" : ""}`}>
    {product.image === "/product-sheet.png" && position ?
      <div role="img" aria-label={`Bao bì gốc DermaAngel ${product.name}`} className="product-sprite" style={{ backgroundPosition: `-${position[0]}px -${position[1]}px` }} /> :
      <img src={product.image} alt={`Bao bì DermaAngel ${product.name}`} loading="lazy" />}
  </div>;
}
