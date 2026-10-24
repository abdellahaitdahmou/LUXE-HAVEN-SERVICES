import React from "react";
import { BrandMark } from "@/components/BrandLogo";
import Link from "next/link";
import { getPublishedPropertiesPreview } from "@/lib/db";
import { formatPropertyTypeLabel } from "@/lib/i18n";
import {
  ArrowRight,
  ExternalLink,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const properties = await getPublishedPropertiesPreview(6);
  const heroProperty = properties[0] || null;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1E1B18] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0B0B0C]/95 border-b border-[#D4AF37]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={40} />
            <div>
              <span className="font-serif font-bold text-xl tracking-wide text-[#F3E3B0]">
                LUXE HAVEN
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#E7CB7A] font-medium">
                Morocco Guest-Services Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              Sign In
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-[#E7CB7A] to-[#C9A24A] hover:from-[#F0D88F] hover:to-[#D4AF37] text-[#1E1B18] text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Open Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-14">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFE6DA] border border-[#E2D4C3] text-xs font-semibold text-[#C85A32]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                NFC & QR Concierge for Moroccan Riads, Villas & Apartments
              </span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#1E1B18] leading-[1.12]">
              Effortless in-stay extra services, routed directly via{" "}
              <span className="text-[#C85A32]">WhatsApp</span>.
            </h1>

            <p className="text-base sm:text-lg text-[#5C4A3B] leading-relaxed max-w-2xl">
              Guests tap an NFC card or scan a QR code in your property to
              browse curated services—from morning beldi breakfast and private
              Dada dinners to hammam rituals and surf lessons—and request them
              in seconds without creating an account.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {heroProperty && (
                <Link
                  href={`/stay/${heroProperty.slug}`}
                  className="px-5 py-3.5 rounded-2xl bg-[#C85A32] hover:bg-[#A64522] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md transition"
                >
                  <span>Experience Guest Page ({heroProperty.city})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}

              <Link
                href="/admin"
                className="px-5 py-3.5 rounded-2xl bg-[#1E1B18] hover:bg-[#2E2722] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md transition"
              >
                <LayoutDashboard className="w-4 h-4 text-[#F4A261]" />
                <span>Manage Properties & Catalogue</span>
              </Link>
            </div>
          </div>

          {/* Right Highlight Card */}
          <div className="lg:col-span-5 rounded-3xl bg-[#1E1B18] text-white p-6 sm:p-7 border border-[#3A2B20] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F4A261]">
                Built for Moroccan Hospitality
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                MAD · Africa/Casablanca
              </span>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <QrCode className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
                <span>
                  <strong>Downloadable QR & NFC Links:</strong> Dedicated{" "}
                  <code className="text-[#F4A261]">/stay/[slug]</code> guest
                  page per property with EN/FR switcher and RTL readiness.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Smart WhatsApp Routing:</strong> Route breakfast to
                  your kitchen partner, surf lessons to the coach, and late
                  checkout to the primary host.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Wand2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>AI-Assisted Service Suggestions:</strong> Matches
                  existing catalogue templates first and proposes tailored
                  services based on property type, features, and city.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Server Validation & RLS:</strong> Server-side
                  pricing, timezone schedule checks, and role-based isolation.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Published Properties Section */}
        {properties.length > 0 && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C85A32]">
                  Synced Hostaway Portfolio
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E1B18] mt-1">
                  Explore Public Guest Experiences
                </h2>
              </div>
              <Link
                href="/admin"
                className="text-xs font-semibold text-[#C85A32] hover:underline inline-flex items-center gap-1"
              >
                <span>Manage all properties in Admin Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="rounded-3xl bg-white border border-[#E6DACB] overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="h-48 w-full relative bg-[#EFE6DA]">
                      <img
                        src={
                          prop.photos[0] ||
                          "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80"
                        }
                        alt={prop.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#FAF6F0]/95 text-[#3A2B20] text-xs font-semibold flex items-center gap-1 shadow-sm">
                        <MapPin className="w-3 h-3 text-[#C85A32]" />
                        <span>{prop.city}</span>
                      </div>
                    </div>

                    <div className="p-5 space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C85A32]">
                        {formatPropertyTypeLabel(prop.property_type, "en")}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#1E1B18] line-clamp-1">
                        {prop.name}
                      </h3>
                      <p className="text-xs text-[#5C4A3B] leading-relaxed line-clamp-3">
                        {prop.description_en}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <Link
                      href={`/stay/${prop.slug}`}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#F2EAE0] hover:bg-[#C85A32] text-[#3A2B20] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <span>Open Guest Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
