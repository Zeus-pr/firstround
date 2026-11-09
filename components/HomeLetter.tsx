"use client";

import dynamic from "next/dynamic";

const Letter = dynamic(() => import("@/components/Letter").then((mod) => mod.Letter), {
  ssr: false,
});

export function HomeLetter({ initialSeat }: { initialSeat?: string }) {
  return <Letter initialSeat={initialSeat} />;
}
