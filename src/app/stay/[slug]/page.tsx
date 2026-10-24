import React from "react";
import Link from "next/link";
import { getPublicPropertyBySlug } from "@/lib/db";
import { GuestStayExperience } from "@/components/guest/GuestStayExperience";

export const dynamic = "force-dynamic";

export default async function PublicPropertyStayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicPropertyBySlug(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#1E1B18] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-white border border-[#E2D4C3] p-8 text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/15 text-[#C85A32] font-serif font-bold text-xl flex items-center justify-center mx-auto">
            S
          </div>
          <h1 className="font-serif text-2xl font-bold">
            Property Page Unavailable
          </h1>
          <p className="text-sm text-[#5C4A3B] leading-relaxed">
            The property link <code className="font-mono">/stay/{slug}</code>{" "}
            either does not exist or has not been published by the host yet.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-[#C85A32] text-white text-xs font-semibold hover:bg-[#A64522] transition"
            >
              Return to LUXE HAVEN Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GuestStayExperience
      property={data.property}
      services={data.services}
      categories={data.categories}
    />
  );
}
