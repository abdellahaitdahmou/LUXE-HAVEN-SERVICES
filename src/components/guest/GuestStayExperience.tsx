"use client";

import React, { useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandLogo";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Check,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  HeartHandshake,
  Info,
  KeyRound,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  UtensilsCrossed,
  Car,
  X,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  PublicPropertyServiceView,
  PublicPropertyView,
  ServiceCategory,
  SupportedLocale,
} from "@/lib/types";
import {
  formatFeatureLabel,
  formatPricingUnitBadge,
  formatPricingUnitLabel,
  formatPropertyTypeLabel,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
} from "@/lib/i18n";

interface GuestStayExperienceProps {
  property: PublicPropertyView;
  services: PublicPropertyServiceView[];
  categories: ServiceCategory[];
}

interface PreparedRequestResult {
  request: {
    id: string;
    reference_code: string;
    property_name: string;
    service_name: string;
    guest_name: string;
    requested_date: string;
    requested_time: string | null;
    quantity: number;
    pricing_unit: PublicPropertyServiceView["pricing_unit"];
    pricing_mode: PublicPropertyServiceView["pricing_mode"];
    estimated_total: number | null;
    currency: string;
    status: string;
    whatsapp_handoff_at: string;
    is_demo_recipient: boolean;
    recipient_label: string;
    used_override_recipient: boolean;
  };
  whatsappMessage: string;
  waMeUrl: string;
}

function getCategoryIcon(iconName: string) {
  switch (iconName) {
    case "Car":
      return Car;
    case "UtensilsCrossed":
      return UtensilsCrossed;
    case "Sparkles":
      return Sparkles;
    case "HeartHandshake":
      return HeartHandshake;
    case "Compass":
      return Compass;
    case "KeyRound":
      return KeyRound;
    default:
      return Sparkles;
  }
}

function getDefaultValidDateForService(
  service: PublicPropertyServiceView
): string {
  const base = new Date();
  const daysToAdd = Math.max(2, Math.ceil(service.advance_notice_hours / 24) + 1);
  for (let offset = daysToAdd; offset <= daysToAdd + 14; offset++) {
    const candidate = new Date(base.getTime() + offset * 86400000);
    const iso = candidate.toISOString().slice(0, 10);
    const weekday = candidate.getUTCDay();
    const isBlackedOut = service.blackouts.some(
      (b) => b.unavailable_date === iso
    );
    const dayRule = service.availability.find((a) => a.weekday === weekday);
    const isDayOpen = dayRule ? dayRule.is_available : true;
    if (!isBlackedOut && isDayOpen) {
      return iso;
    }
  }
  return new Date(base.getTime() + 3 * 86400000).toISOString().slice(0, 10);
}

function getDefaultValidTimeForService(
  service: PublicPropertyServiceView,
  isoDate: string
): string {
  if (!service.requires_time_slot) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday =
    y && m && d ? new Date(Date.UTC(y, m - 1, d)).getUTCDay() : 1;
  const rule = service.availability.find(
    (a) => a.weekday === weekday && a.is_available
  );
  if (!rule) return "09:00";
  const start = rule.start_time.slice(0, 5);
  return start < "09:00" && rule.end_time.slice(0, 5) >= "09:00"
    ? "09:00"
    : start;
}

export function GuestStayExperience({
  property,
  services,
  categories,
}: GuestStayExperienceProps) {
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [showFullDescription, setShowFullDescription] =
    useState<boolean>(false);

  // Selected service for request modal
  const [activeService, setActiveService] =
    useState<PublicPropertyServiceView | null>(null);
  const [guestName, setGuestName] = useState<string>("");
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [requestedTime, setRequestedTime] = useState<string>("09:00");
  const [quantity, setQuantity] = useState<number>(1);
  const [guestNote, setGuestNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Prepared request summary state
  const [preparedResult, setPreparedResult] =
    useState<PreparedRequestResult | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const dir = SUPPORTED_LOCALES[locale]?.dir || "ltr";

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategory !== "all" && s.category_key !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const title = (locale === "fr" ? s.name_fr || s.name_en : s.name_en).toLowerCase();
        const desc = (
          locale === "fr" ? s.description_fr || s.description_en : s.description_en
        ).toLowerCase();
        return title.includes(q) || desc.includes(q);
      }
      return true;
    });
  }, [services, selectedCategory, searchQuery, locale]);

  const openServiceDrawer = (service: PublicPropertyServiceView) => {
    const defaultDate = getDefaultValidDateForService(service);
    const defaultTime = getDefaultValidTimeForService(service, defaultDate);
    setActiveService(service);
    setRequestedDate(defaultDate);
    setRequestedTime(defaultTime);
    setQuantity(service.min_quantity);
    setGuestNote("");
    setFormError(null);
    setPreparedResult(null);
    setIdempotencyKey(
      `req-${service.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  };

  const closeServiceDrawer = () => {
    setActiveService(null);
    setPreparedResult(null);
    setFormError(null);
  };

  // Client-side schedule helper to show immediate feedback for selected date
  const selectedDateScheduleInfo = useMemo(() => {
    if (!activeService || !requestedDate) return null;
    const blackout = activeService.blackouts.find(
      (b) => b.unavailable_date === requestedDate
    );
    const [y, m, d] = requestedDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dayRule = activeService.availability.find(
      (a) => a.weekday === weekday
    );
    return {
      weekday,
      dayName: t.weekdaysFull[weekday],
      blackout,
      dayRule,
    };
  }, [activeService, requestedDate, t.weekdaysFull]);

  const handlePrepareRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeService) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/public/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_slug: property.slug,
          property_service_id: activeService.id,
          guest_name: guestName,
          requested_date: requestedDate,
          requested_time: activeService.requires_time_slot
            ? requestedTime
            : null,
          quantity,
          guest_note: guestNote,
          guest_locale: locale,
          idempotency_key: idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Could not validate your service request.");
      } else {
        setPreparedResult(data);
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Network error while preparing your request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const localizedDescription =
    locale === "fr"
      ? property.description_fr || property.description_en
      : property.description_en;

  const localizedWelcome =
    locale === "fr"
      ? property.welcome_message_fr || property.welcome_message_en
      : property.welcome_message_en;

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#FAF6F0] text-[#1E1B18] pb-20 selection:bg-[#C85A32]/20"
    >
      {/* Top Hospitality Bar with Language Switcher */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0B0B0C]/95 border-b border-[#D4AF37]/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={40} />
            <div>
              <span className="font-serif font-bold text-lg tracking-wide text-[#F3E3B0]">
                LUXE HAVEN
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#E7CB7A] font-medium">
                {t.welcomeBadge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher (EN / FR + RTL Ready Indicator) */}
            <div
              role="group"
              aria-label="Language switcher"
              className="inline-flex items-center rounded-full bg-white/10 p-1 border border-[#D4AF37]/30"
            >
              <Globe className="w-3.5 h-3.5 text-[#E7CB7A] ml-2 mr-1" />
              {(["en", "fr"] as SupportedLocale[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    locale === lang
                      ? "bg-[#C85A32] text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Property Photography & Welcome Banner */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
        <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#E6DACB] bg-[#2B231D]">
          <div className="relative h-72 sm:h-96 md:h-[420px] w-full group">
            <img
              src={
                property.photos[activePhotoIdx] ||
                "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80"
              }
              alt={property.name}
              className="w-full h-full object-cover transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 pointer-events-none" />

            {/* Photo counter badge & Prev/Next controls */}
            {property.photos.length > 1 && (
              <>
                <div className="absolute top-4 right-4 bg-black/55 backdrop-blur-md border border-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                  {activePhotoIdx + 1} / {property.photos.length}
                </div>

                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() =>
                    setActivePhotoIdx((prev) =>
                      prev === 0 ? property.photos.length - 1 : prev - 1
                    )
                  }
                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() =>
                    setActivePhotoIdx((prev) =>
                      prev === property.photos.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 text-white">
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#C85A32] text-white shadow-sm">
                  {formatPropertyTypeLabel(property.property_type, locale)}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-black/45 backdrop-blur-md border border-white/15 text-white">
                  <MapPin className="w-3.5 h-3.5 text-[#F4A261]" />
                  {property.city}, Morocco
                </span>
                {property.map_url && (
                  <a
                    href={property.map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition"
                  >
                    <span>{t.mapLinkLabel}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight drop-shadow-sm">
                {property.name}
              </h1>
            </div>
          </div>

          {/* Interactive Thumbnail Strip */}
          {property.photos.length > 1 && (
            <div className="bg-[#1E1915] px-4 py-2.5 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {property.photos.map((photoUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  aria-label={`Select photo ${idx + 1}`}
                  className={`relative shrink-0 w-16 h-11 rounded-lg overflow-hidden border-2 transition-all ${
                    activePhotoIdx === idx
                      ? "border-[#F4A261] scale-[1.03] opacity-100"
                      : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`${property.name} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Warm Welcome Card, Collapsible Description & Property Features */}
          <div className="bg-[#F5EDE2] p-5 sm:p-6 border-t border-[#E6DACB]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-sm sm:text-base font-semibold text-[#3A2B20] leading-relaxed">
                  “{localizedWelcome}”
                </p>
                <p className="text-xs text-[#7A6552] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>
                    {t.timezoneFootnote}: <strong>{property.timezone}</strong> ·{" "}
                    <strong>{property.currency}</strong>
                  </span>
                </p>
              </div>
            </div>

            {localizedDescription && (
              <div className="mt-3.5 pt-3.5 border-t border-[#E5D8C7]">
                <p
                  className={`text-xs sm:text-sm text-[#5C4A3B] leading-relaxed whitespace-pre-line ${
                    showFullDescription ? "" : "line-clamp-2"
                  }`}
                >
                  {localizedDescription}
                </p>
                {localizedDescription.length > 160 && (
                  <button
                    type="button"
                    onClick={() => setShowFullDescription((prev) => !prev)}
                    className="mt-1.5 text-xs font-semibold text-[#C85A32] hover:underline"
                  >
                    {showFullDescription
                      ? locale === "fr"
                        ? "Voir moins ↑"
                        : "Show less ↑"
                      : locale === "fr"
                      ? "Lire la description complète ↓"
                      : "Read full property details ↓"}
                  </button>
                )}
              </div>
            )}

            {property.features.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#E5D8C7] flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7058] mr-1">
                  {t.featuresHeading}:
                </span>
                {property.features.map((feat) => (
                  <span
                    key={feat}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FAF6F0] text-[#4B3A2C] border border-[#E2D4C3]"
                  >
                    {formatFeatureLabel(feat, locale)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search & Category Filters */}
        <section className="mt-8 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C7058] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchServices}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-[#E2D4C3] text-sm text-[#1E1B18] placeholder-[#9B8571] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                selectedCategory === "all"
                  ? "bg-[#C85A32] text-white shadow-sm"
                  : "bg-white text-[#5C4A3B] border border-[#E2D4C3] hover:bg-[#F2EAE0]"
              }`}
            >
              {t.allCategories} ({services.length})
            </button>

            {categories.map((cat) => {
              const count = services.filter(
                (s) => s.category_key === cat.key
              ).length;
              if (count === 0) return null;
              const Icon = getCategoryIcon(cat.icon_name);
              const catLabel =
                locale === "fr" ? cat.name_fr : cat.name_en;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    selectedCategory === cat.key
                      ? "bg-[#C85A32] text-white shadow-sm"
                      : "bg-white text-[#5C4A3B] border border-[#E2D4C3] hover:bg-[#F2EAE0]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{catLabel}</span>
                  <span className="opacity-75 text-xs">({count})</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Available Service Cards Grid */}
        <section className="mt-6">
          {filteredServices.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#E2D4C3] p-10 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-[#C85A32] mx-auto" />
              <p className="font-medium text-[#3A2B20]">
                {t.noServicesInCategory}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredServices.map((service, idx) => {
                const serviceTitle =
                  locale === "fr"
                    ? service.name_fr || service.name_en
                    : service.name_en;
                const serviceDesc =
                  locale === "fr"
                    ? service.description_fr || service.description_en
                    : service.description_en;
                const serviceCond =
                  locale === "fr"
                    ? service.conditions_fr || service.conditions_en
                    : service.conditions_en;

                const catObj = categories.find(
                  (c) => c.key === service.category_key
                );
                const catName = catObj
                  ? locale === "fr"
                    ? catObj.name_fr
                    : catObj.name_en
                  : service.category_key;

                const activeWeekdays = service.availability
                  .filter((a) => a.is_available)
                  .map((a) => t.weekdaysShort[a.weekday]);

                const sampleWindow = service.availability.find(
                  (a) => a.is_available
                );

                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="group rounded-3xl bg-white border border-[#E6DACB] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-48 w-full bg-[#EFE6DA] overflow-hidden">
                        <img
                          src={
                            service.image_url ||
                            "https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=900&q=80"
                          }
                          alt={serviceTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF6F0]/95 text-[#4B3A2C] shadow-sm">
                            {catName}
                          </span>
                        </div>
                        <div className="absolute bottom-3 right-3">
                          {service.pricing_mode === "fixed" &&
                          service.price !== null ? (
                            <div className="px-3.5 py-1.5 rounded-2xl bg-[#1E1B18]/90 backdrop-blur-md text-white text-right shadow-md">
                              <span className="text-base font-bold text-[#F4A261]">
                                {service.price} {service.currency}
                              </span>
                              <span className="block text-[11px] text-white/80">
                                {formatPricingUnitBadge(
                                  service.pricing_unit,
                                  locale
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="px-3.5 py-1.5 rounded-2xl bg-[#C85A32] text-white text-xs font-semibold shadow-md">
                              {t.requestQuote}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <h2 className="font-serif text-xl font-bold text-[#1E1B18]">
                          {serviceTitle}
                        </h2>
                        <p className="text-sm text-[#5C4A3B] leading-relaxed">
                          {serviceDesc}
                        </p>

                        {/* Schedule & Conditions Pill Box */}
                        <div className="rounded-2xl bg-[#FAF6F0] border border-[#EAE0D3] p-3.5 text-xs text-[#5C4A3B] space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-medium text-[#3A2B20]">
                              <Calendar className="w-3.5 h-3.5 text-[#C85A32]" />
                              {t.availableDays}:{" "}
                              {activeWeekdays.length === 7
                                ? locale === "fr"
                                  ? "7j/7"
                                  : "Daily"
                                : activeWeekdays.join(", ")}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[#7A6552]">
                              <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                              {t.advanceNoticeLabel}:{" "}
                              <strong>
                                {service.advance_notice_hours}
                                {t.hoursUnit}
                              </strong>
                            </span>
                          </div>

                          {service.requires_time_slot && sampleWindow && (
                            <div className="text-[#6E5A49]">
                              {t.availableHours}:{" "}
                              <strong>
                                {sampleWindow.start_time.slice(0, 5)} –{" "}
                                {sampleWindow.end_time.slice(0, 5)}
                              </strong>{" "}
                              ({property.timezone})
                            </div>
                          )}

                          {serviceCond && (
                            <p className="text-[#7A6552] pt-1 border-t border-[#EAE0D3] italic">
                              {serviceCond}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-1">
                      <button
                        type="button"
                        onClick={() => openServiceDrawer(service)}
                        className="w-full py-3 px-4 rounded-2xl bg-[#C85A32] hover:bg-[#A64522] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{t.configureRequest}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Request Form & Summary Modal / Drawer */}
      <AnimatePresence>
        {activeService && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF6F0] text-[#1E1B18] border border-[#E2D4C3] shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-[#FAF6F0]/95 backdrop-blur-md px-6 py-4 border-b border-[#E2D4C3] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C85A32]">
                    {property.name}
                  </span>
                  <h3 className="font-serif text-xl font-bold text-[#1E1B18]">
                    {locale === "fr"
                      ? activeService.name_fr || activeService.name_en
                      : activeService.name_en}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeServiceDrawer}
                  aria-label="Close modal"
                  className="p-2 rounded-full bg-[#EFE6DA] text-[#4B3A2C] hover:bg-[#E2D4C3] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: Request Configuration Form */}
              {!preparedResult ? (
                <form
                  onSubmit={handlePrepareRequest}
                  className="p-6 space-y-5"
                >
                  {formError && (
                    <div
                      role="alert"
                      className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
                    >
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Guest Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C4A3B] mb-1.5">
                      {t.guestNameLabel} *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder={t.guestNamePlaceholder}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D8C7B4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                    />
                  </div>

                  {/* Date & Time Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C4A3B] mb-1.5">
                        {t.requestedDateLabel} *
                      </label>
                      <input
                        type="date"
                        required
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D8C7B4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                      />
                    </div>

                    {activeService.requires_time_slot && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C4A3B] mb-1.5">
                          {t.requestedTimeLabel} ({property.timezone}) *
                        </label>
                        <input
                          type="time"
                          required
                          value={requestedTime}
                          onChange={(e) => setRequestedTime(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D8C7B4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Live Schedule Guidance Banner */}
                  {selectedDateScheduleInfo && (
                    <div className="rounded-xl bg-[#F2EAE0] border border-[#E2D4C3] p-3 text-xs text-[#4B3A2C] space-y-1">
                      {selectedDateScheduleInfo.blackout ? (
                        <p className="text-red-700 font-semibold">
                          Unavailable on {requestedDate}:{" "}
                          {selectedDateScheduleInfo.blackout.reason ||
                            "Blackout date"}
                        </p>
                      ) : selectedDateScheduleInfo.dayRule &&
                        !selectedDateScheduleInfo.dayRule.is_available ? (
                        <p className="text-red-700 font-semibold">
                          This service is closed on{" "}
                          {selectedDateScheduleInfo.dayName}s. Please pick
                          another date.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <strong>{selectedDateScheduleInfo.dayName}</strong>{" "}
                            {activeService.requires_time_slot &&
                            selectedDateScheduleInfo.dayRule
                              ? `window: ${selectedDateScheduleInfo.dayRule.start_time.slice(
                                  0,
                                  5
                                )} – ${selectedDateScheduleInfo.dayRule.end_time.slice(
                                  0,
                                  5
                                )}`
                              : "available"}
                          </span>
                          <span>
                            Min. notice:{" "}
                            <strong>
                              {activeService.advance_notice_hours}h
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quantity Selector with Unit Label */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#5C4A3B]">
                        {t.quantityLabel} (
                        {formatPricingUnitLabel(
                          activeService.pricing_unit,
                          locale,
                          quantity
                        )}
                        )
                      </label>
                      <span className="text-xs text-[#7A6552]">
                        Min {activeService.min_quantity} · Max{" "}
                        {activeService.max_quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-[#D8C7B4]">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((q) =>
                            Math.max(activeService.min_quantity, q - 1)
                          )
                        }
                        disabled={quantity <= activeService.min_quantity}
                        className="w-8 h-8 rounded-lg bg-[#F2EAE0] text-[#1E1B18] flex items-center justify-center disabled:opacity-40"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-base">
                        {quantity}{" "}
                        {formatPricingUnitLabel(
                          activeService.pricing_unit,
                          locale,
                          quantity
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((q) =>
                            Math.min(activeService.max_quantity, q + 1)
                          )
                        }
                        disabled={quantity >= activeService.max_quantity}
                        className="w-8 h-8 rounded-lg bg-[#F2EAE0] text-[#1E1B18] flex items-center justify-center disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C4A3B] mb-1.5">
                      {t.optionalNoteLabel}
                    </label>
                    <textarea
                      rows={2}
                      value={guestNote}
                      onChange={(e) => setGuestNote(e.target.value)}
                      placeholder={t.optionalNotePlaceholder}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D8C7B4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                    />
                  </div>

                  {/* Estimated Price Box */}
                  <div className="rounded-2xl bg-[#F2EAE0] border border-[#DECBB6] p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#6E5A49]">
                        {t.estimatedTotalLabel}
                      </span>
                      <p className="text-[11px] text-[#7A6552]">
                        Calculated by server on confirmation
                      </p>
                    </div>
                    <div className="text-right">
                      {activeService.pricing_mode === "fixed" &&
                      activeService.price !== null ? (
                        <span className="text-xl font-bold text-[#C85A32]">
                          {Number(
                            (activeService.price * quantity).toFixed(2)
                          )}{" "}
                          {activeService.currency}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-[#C85A32]">
                          {t.quoteEstimatedTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-5 rounded-2xl bg-[#C85A32] hover:bg-[#A64522] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
                  >
                    {submitting
                      ? "Validating & Preparing Request..."
                      : t.reviewSummaryBtn}
                  </button>
                </form>
              ) : (
                /* Step 2: Request Summary Before Opening WhatsApp */
                <div className="p-6 space-y-5">
                  <div className="rounded-2xl bg-emerald-950/5 border border-emerald-700/25 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm space-y-1">
                      <div className="font-semibold text-emerald-950 flex items-center gap-2">
                        <span>
                          {t.requestReferenceLabel}:{" "}
                          <code className="px-2 py-0.5 rounded bg-emerald-700/15 font-mono">
                            {preparedResult.request.reference_code}
                          </code>
                        </span>
                      </div>
                      <p className="text-[#4B3A2C] font-medium">
                        {t.confirmationDisclaimer}
                      </p>
                      <p className="text-xs text-[#6E5A49]">
                        {t.preparedNotice}
                      </p>
                    </div>
                  </div>

                  {/* Pre-filled WhatsApp Message Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#5C4A3B]">
                        WhatsApp Message Summary
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            preparedResult.whatsappMessage
                          );
                          setCopiedMessage(true);
                          setTimeout(() => setCopiedMessage(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#C85A32] hover:underline"
                      >
                        {copiedMessage ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy Message
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs bg-white border border-[#D8C7B4] rounded-2xl p-4 text-[#2B231D] leading-relaxed">
                      {preparedResult.whatsappMessage}
                    </pre>
                  </div>

                  {/* Demo Contact Safeguard vs Live WhatsApp Handoff */}
                  {preparedResult.request.is_demo_recipient ? (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-600/30 p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Info className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs text-amber-950">
                          <p className="font-bold">
                            {t.demoContactProtectedTitle}
                          </p>
                          <p className="leading-relaxed">
                            {t.demoContactProtectedBody}
                          </p>
                          <p className="text-[11px] text-amber-900 pt-1">
                            Resolved Recipient:{" "}
                            <strong>
                              {preparedResult.request.recipient_label}
                            </strong>{" "}
                            (
                            {preparedResult.request.used_override_recipient
                              ? "Service Override"
                              : "Property Default Host"}
                            )
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/90 rounded-xl p-2.5 border border-amber-600/20 flex items-center justify-between gap-2">
                        <code className="text-[11px] text-[#3A2B20] truncate">
                          {preparedResult.waMeUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              preparedResult.waMeUrl
                            );
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-[#C85A32] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3 h-3" /> Copied URL
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy wa.me Link
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-2xl bg-slate-300 text-slate-600 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>
                          External WhatsApp Handoff Disabled for Demo Number
                        </span>
                      </button>
                    </div>
                  ) : (
                    <a
                      href={preparedResult.waMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{t.openWhatsAppBtn}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setPreparedResult(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C4A3B] hover:text-[#1E1B18]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t.editRequestBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={closeServiceDrawer}
                      className="px-4 py-2 rounded-xl bg-[#EFE6DA] text-xs font-semibold text-[#3A2B20] hover:bg-[#E2D4C3]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
