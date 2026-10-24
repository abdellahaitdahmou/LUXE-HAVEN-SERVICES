"use client";

import React, { useEffect, useState } from "react";
import {
  AISuggestionItem,
  AISuggestionResponse,
  PricingMode,
  PricingUnit,
  Property,
  PropertyService,
  PropertyServiceAvailability,
  PropertyServiceBlackout,
  PropertyStatus,
  PropertyType,
  ServiceCatalogItem,
  ServiceCategory,
} from "@/lib/types";
import {
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { formatPricingUnitBadge } from "@/lib/i18n";
import { isDemoPlaceholderPhone } from "@/lib/whatsapp";

interface EnrichedPropertyService extends PropertyService {
  effectiveRecipient: {
    source: "service_override" | "property_default";
    e164: string;
    internationalDigits: string;
    label: string;
    isDemoContact: boolean;
  };
  availability: PropertyServiceAvailability[];
  blackouts: PropertyServiceBlackout[];
}

interface PropertyWorkspaceModalProps {
  propertyId: string;
  categories: ServiceCategory[];
  onClose: () => void;
  onUpdated: () => void;
}

const FEATURE_OPTIONS = [
  "pool",
  "hammam",
  "garden",
  "kitchen",
  "beach_proximity",
  "terrace",
  "wifi",
  "air_conditioning",
  "parking",
  "surf_rack",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PropertyWorkspaceModal({
  propertyId,
  categories,
  onClose,
  onUpdated,
}: PropertyWorkspaceModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "details" | "qr">(
    "services"
  );

  const [property, setProperty] = useState<Property | null>(null);
  const [services, setServices] = useState<EnrichedPropertyService[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceCatalogItem[]>(
    []
  );

  // Property Details Edit State
  const [propName, setPropName] = useState("");
  const [propSlug, setPropSlug] = useState("");
  const [propType, setPropType] = useState<PropertyType>("apartment");
  const [propCity, setPropCity] = useState("");
  const [propMapUrl, setPropMapUrl] = useState("");
  const [propDescEn, setPropDescEn] = useState("");
  const [propDescFr, setPropDescFr] = useState("");
  const [propWelcomeEn, setPropWelcomeEn] = useState("");
  const [propWelcomeFr, setPropWelcomeFr] = useState("");
  const [propFeatures, setPropFeatures] = useState<string[]>([]);
  const [propPhotos, setPropPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [propWhatsapp, setPropWhatsapp] = useState("");
  const [propWhatsappLabel, setPropWhatsappLabel] = useState("");
  const [propIsDemoContact, setPropIsDemoContact] = useState(false);
  const [propTimezone, setPropTimezone] = useState("Africa/Casablanca");
  const [propCurrency, setPropCurrency] = useState("MAD");
  const [propStatus, setPropStatus] = useState<PropertyStatus>("published");
  const [savingProp, setSavingProp] = useState(false);
  const [propFeedback, setPropFeedback] = useState<string | null>(null);

  // Add from Catalogue state
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCatFilter, setCatalogCatFilter] = useState("all");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [attachingCatalog, setAttachingCatalog] = useState(false);

  // AI Suggestions state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AISuggestionResponse | null>(
    null
  );
  const [selectedAiIds, setSelectedAiIds] = useState<string[]>([]);
  const [customAiPrices, setCustomAiPrices] = useState<Record<string, string>>(
    {}
  );
  const [addingAiSuggestions, setAddingAiSuggestions] = useState(false);

  // Property-Specific Service Editor state
  const [editingService, setEditingService] =
    useState<EnrichedPropertyService | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [newBlackoutDate, setNewBlackoutDate] = useState("");
  const [newBlackoutReason, setNewBlackoutReason] = useState("");

  // NFC Link copy state
  const [copiedNfc, setCopiedNfc] = useState(false);

  const loadPropertyDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load property.");
        return;
      }
      const p: Property = data.property;
      setProperty(p);
      setServices(data.services || []);
      setCatalogServices(data.catalogServices || []);

      // Populate form state
      setPropName(p.name);
      setPropSlug(p.slug);
      setPropType(p.property_type);
      setPropCity(p.city);
      setPropMapUrl(p.map_url || "");
      setPropDescEn(p.description_en);
      setPropDescFr(p.description_fr);
      setPropWelcomeEn(p.welcome_message_en);
      setPropWelcomeFr(p.welcome_message_fr);
      setPropFeatures(p.features || []);
      setPropPhotos(p.photos || []);
      setPropWhatsapp(p.default_whatsapp);
      setPropWhatsappLabel(p.default_whatsapp_label || "Primary Host");
      setPropIsDemoContact(p.is_demo_contact);
      setPropTimezone(p.timezone || "Africa/Casablanca");
      setPropCurrency(p.currency || "MAD");
      setPropStatus(p.status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error loading property."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPropertyDetail();
  }, [propertyId]);

  const handleSavePropertyDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProp(true);
    setPropFeedback(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: propName,
          slug: propSlug,
          property_type: propType,
          city: propCity,
          map_url: propMapUrl,
          description_en: propDescEn,
          description_fr: propDescFr,
          welcome_message_en: propWelcomeEn,
          welcome_message_fr: propWelcomeFr,
          features: propFeatures,
          photos: propPhotos,
          default_whatsapp: propWhatsapp,
          default_whatsapp_label: propWhatsappLabel,
          is_demo_contact: propIsDemoContact,
          timezone: propTimezone,
          currency: propCurrency,
          status: propStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update property.");
      } else {
        setPropFeedback("Property settings saved.");
        await loadPropertyDetail();
        onUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingProp(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "properties");

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setPropPhotos((prev) => [...prev, data.url]);
      } else {
        setError(data.error || "Photo upload failed.");
      }
    } catch {
      setError("Failed to upload image.");
    }
  };

  const handleAttachSelectedCatalog = async () => {
    if (selectedCatalogIds.length === 0) return;
    setAttachingCatalog(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogServiceIds: selectedCatalogIds }),
      });
      if (res.ok) {
        setSelectedCatalogIds([]);
        setShowAddCatalogModal(false);
        await loadPropertyDetail();
        onUpdated();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to attach catalogue services.");
      }
    } finally {
      setAttachingCatalog(false);
    }
  };

  const handleTriggerAiSuggestions = async () => {
    setShowAiModal(true);
    setAiLoading(true);
    setSelectedAiIds([]);
    try {
      const res = await fetch(
        `/api/admin/properties/${propertyId}/suggest-services`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_type: propType,
            city: propCity,
            features: propFeatures,
          }),
        }
      );
      const data: AISuggestionResponse = await res.json();
      setAiResponse(data);
      const initialPrices: Record<string, string> = {};
      (data.suggestions || []).forEach((s) => {
        if (s.suggested_price !== null) {
          initialPrices[s.id] = String(s.suggested_price);
        }
      });
      setCustomAiPrices(initialPrices);
    } catch {
      setError("Could not generate service suggestions.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddSelectedAiSuggestions = async () => {
    if (!aiResponse || selectedAiIds.length === 0) return;
    setAddingAiSuggestions(true);
    try {
      const selectedItems: AISuggestionItem[] = aiResponse.suggestions.filter(
        (s) => selectedAiIds.includes(s.id)
      );

      const catalogIdsToAttach = selectedItems
        .filter((s) => s.matched_catalog_id)
        .map((s) => s.matched_catalog_id!);

      if (catalogIdsToAttach.length > 0) {
        await fetch(`/api/admin/properties/${propertyId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogServiceIds: catalogIdsToAttach }),
        });
      }

      // Persist new AI-proposed services ONLY when explicitly selected by the user
      for (const proposal of selectedItems.filter(
        (s) => !s.matched_catalog_id
      )) {
        const customPrice = customAiPrices[proposal.id]
          ? Number(customAiPrices[proposal.id])
          : proposal.suggested_price;

        await fetch(`/api/admin/properties/${propertyId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customProposal: {
              category_key: proposal.category_key,
              name_en: proposal.name_en,
              name_fr: proposal.name_fr,
              description_en: proposal.description_en,
              description_fr: proposal.description_fr,
              default_pricing_mode:
                customPrice !== null && customPrice !== undefined
                  ? "fixed"
                  : proposal.default_pricing_mode,
              suggested_price: customPrice ?? null,
              default_currency: propCurrency || "MAD",
              default_pricing_unit: proposal.default_pricing_unit,
              default_min_quantity: 1,
              default_max_quantity: 8,
              default_advance_notice_hours:
                proposal.default_advance_notice_hours,
              requires_time_slot: proposal.requires_time_slot,
              save_to_org_catalog: true,
            },
          }),
        });
      }

      setShowAiModal(false);
      await loadPropertyDetail();
      onUpdated();
    } finally {
      setAddingAiSuggestions(false);
    }
  };

  const handleSaveEditedService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setSavingService(true);
    setServiceError(null);

    try {
      const res = await fetch(
        `/api/admin/property-services/${editingService.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name_en: editingService.name_en,
            name_fr: editingService.name_fr,
            description_en: editingService.description_en,
            description_fr: editingService.description_fr,
            conditions_en: editingService.conditions_en,
            conditions_fr: editingService.conditions_fr,
            category_key: editingService.category_key,
            image_url: editingService.image_url,
            is_active: editingService.is_active,
            pricing_mode: editingService.pricing_mode,
            price:
              editingService.pricing_mode === "fixed"
                ? Number(editingService.price ?? 0)
                : null,
            currency: editingService.currency,
            pricing_unit: editingService.pricing_unit,
            min_quantity: Number(editingService.min_quantity),
            max_quantity: Number(editingService.max_quantity),
            advance_notice_hours: Number(editingService.advance_notice_hours),
            requires_time_slot: editingService.requires_time_slot,
            display_order: Number(editingService.display_order),
            whatsapp_override: editingService.whatsapp_override || "",
            whatsapp_override_label:
              editingService.whatsapp_override_label || "",
            is_demo_override_contact: editingService.is_demo_override_contact,
            availability: editingService.availability.map((a) => ({
              weekday: a.weekday,
              start_time: a.start_time.slice(0, 5),
              end_time: a.end_time.slice(0, 5),
              is_available: a.is_available,
            })),
            blackouts: editingService.blackouts.map((b) => ({
              unavailable_date: b.unavailable_date,
              reason: b.reason,
            })),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setServiceError(data.error || "Could not save service settings.");
      } else {
        setEditingService(null);
        await loadPropertyDetail();
        onUpdated();
      }
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingService(false);
    }
  };

  const handleDeletePropertyService = async (svcId: string) => {
    const res = await fetch(`/api/admin/property-services/${svcId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadPropertyDetail();
      onUpdated();
    }
  };

  const publicStayUrl =
    typeof window !== "undefined" && property
      ? `${window.location.origin}/stay/${property.slug}`
      : property
      ? `/stay/${property.slug}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0F141C] border border-slate-800 text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-[#131A24] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F4A261]">
                Property Workspace
              </span>
              {property && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                    property.status === "published"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : property.status === "draft"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {property.status}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {property ? `${property.name} (${property.city})` : "Loading..."}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {property && property.status === "published" && (
              <a
                href={`/stay/${property.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition"
              >
                <span>Open Public Guest Page</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#F4A261]" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-[#131A24]/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "services"
                ? "border-[#C85A32] text-[#F4A261]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Property Services & WhatsApp Routing ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "details"
                ? "border-[#C85A32] text-[#F4A261]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Property Settings & Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "qr"
                ? "border-[#C85A32] text-[#F4A261]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            QR Code & NFC Card Link
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#C85A32]" />
              <span className="text-sm">Loading property configuration...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Access or Validation Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : property ? (
            <>
              {/* TAB 1: ATTACHED SERVICES & WHATSAPP ROUTING */}
              {activeTab === "services" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Property-Specific Services Configuration
                      </p>
                      <p className="text-xs text-slate-400">
                        Changes to prices, schedules, or WhatsApp overrides here
                        apply <strong>only to {property.name}</strong> and never
                        affect other properties or catalogue templates.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleTriggerAiSuggestions}
                        className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-2 transition"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span>Suggest Services (AI)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddCatalogModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-2 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add from Catalogue</span>
                      </button>
                    </div>
                  </div>

                  {/* Services Table/Cards */}
                  {services.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-3">
                      <Sparkles className="w-8 h-8 text-[#F4A261] mx-auto" />
                      <p className="font-semibold text-slate-200">
                        No services attached to this property yet.
                      </p>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Select starter templates from the reusable catalogue or
                        use “Suggest Services (AI)” to get tailored
                        recommendations for {property.city}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {services.map((svc) => {
                        const openDaysCount = svc.availability.filter(
                          (a) => a.is_available
                        ).length;
                        return (
                          <div
                            key={svc.id}
                            className="rounded-2xl bg-[#131A24] border border-slate-800/90 p-5 flex flex-col justify-between gap-4 hover:border-slate-700 transition"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        svc.is_active
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {svc.is_active ? "Active" : "Inactive"}
                                    </span>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">
                                      {svc.category_key.replace("_", " ")}
                                    </span>
                                  </div>
                                  <h3 className="text-base font-bold text-white mt-1">
                                    {svc.name_en}
                                  </h3>
                                  {svc.name_fr && (
                                    <p className="text-xs text-slate-400">
                                      FR: {svc.name_fr}
                                    </p>
                                  )}
                                </div>

                                <div className="text-right">
                                  {svc.pricing_mode === "fixed" ? (
                                    <div>
                                      <span className="text-lg font-bold text-[#F4A261]">
                                        {svc.price} {svc.currency}
                                      </span>
                                      <span className="block text-[11px] text-slate-400">
                                        {formatPricingUnitBadge(
                                          svc.pricing_unit,
                                          "en"
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-semibold">
                                      Quote Required
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 line-clamp-2">
                                {svc.description_en}
                              </p>

                              {/* Effective WhatsApp Recipient Box */}
                              <div className="rounded-xl bg-[#0B0F17] border border-slate-800/80 p-3 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    Effective WhatsApp Recipient:
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      svc.effectiveRecipient.source ===
                                      "service_override"
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                    }`}
                                  >
                                    {svc.effectiveRecipient.source ===
                                    "service_override"
                                      ? "1. Service Override"
                                      : "2. Property Default Host"}
                                  </span>
                                </div>
                                <div className="font-mono text-slate-200 font-semibold">
                                  {svc.effectiveRecipient.e164} —{" "}
                                  <span className="font-sans font-normal text-slate-300">
                                    {svc.effectiveRecipient.label}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                <span>
                                  Qty: {svc.min_quantity}–{svc.max_quantity}
                                </span>
                                <span>·</span>
                                <span>
                                  Notice: {svc.advance_notice_hours}h
                                </span>
                                <span>·</span>
                                <span>Open {openDaysCount}/7 days</span>
                                {svc.blackouts.length > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-amber-300">
                                      {svc.blackouts.length} blackout date(s)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setEditingService(svc)}
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#F4A261]" />
                                <span>Configure Price, Schedule & WhatsApp</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeletePropertyService(svc.id)
                                }
                                aria-label="Remove service from property"
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROPERTY DETAILS & PUBLISHING */}
              {activeTab === "details" && (
                <form
                  onSubmit={handleSavePropertyDetails}
                  className="space-y-6 max-w-4xl"
                >
                  {propFeedback && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>{propFeedback}</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Security Policy:</strong> Do not publish door
                      codes, keybox PINs, guest identity documents, or Wi-Fi
                      passwords on public property pages.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Property Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={propName}
                        onChange={(e) => setPropName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Public Slug (/stay/[slug]) *
                      </label>
                      <input
                        type="text"
                        required
                        value={propSlug}
                        onChange={(e) =>
                          setPropSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                          )
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Property Type
                      </label>
                      <select
                        value={propType}
                        onChange={(e) =>
                          setPropType(e.target.value as PropertyType)
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white"
                      >
                        <option value="apartment">Apartment</option>
                        <option value="villa">Villa</option>
                        <option value="riad">Riad</option>
                        <option value="studio">Studio</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={propCity}
                        onChange={(e) => setPropCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={propStatus}
                        onChange={(e) =>
                          setPropStatus(e.target.value as PropertyStatus)
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white"
                      >
                        <option value="published">Published (Live)</option>
                        <option value="draft">Draft (Unpublished)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Currency & Timezone
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={3}
                          value={propCurrency}
                          onChange={(e) =>
                            setPropCurrency(e.target.value.toUpperCase())
                          }
                          className="w-20 px-3 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm font-mono text-white"
                        />
                        <input
                          type="text"
                          value={propTimezone}
                          onChange={(e) => setPropTimezone(e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-xs font-mono text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Default Host WhatsApp */}
                  <div className="p-4 rounded-2xl bg-[#131A24] border border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      Default Host WhatsApp Recipient
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          WhatsApp Number (International Format) *
                        </label>
                        <input
                          type="text"
                          required
                          value={propWhatsapp}
                          onChange={(e) => {
                            const next = e.target.value;
                            setPropWhatsapp(next);
                            // A real (non-placeholder) number means live handoff is wanted.
                            if (next.trim() && !isDemoPlaceholderPhone(next)) {
                              setPropIsDemoContact(false);
                            }
                          }}
                          placeholder="+212612345678"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Recipient Label (Internal)
                        </label>
                        <input
                          type="text"
                          value={propWhatsappLabel}
                          onChange={(e) => setPropWhatsappLabel(e.target.value)}
                          placeholder="e.g., Youssef — Primary Host"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
                        />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={propIsDemoContact}
                        onChange={(e) => setPropIsDemoContact(e.target.checked)}
                        className="rounded border-slate-600"
                      />
                      <span>
                        Mark as unconfigured demo contact (disables external
                        WhatsApp handoff so test clicks never message real
                        numbers)
                      </span>
                    </label>
                  </div>

                  {/* Descriptions EN / FR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Description (English)
                      </label>
                      <textarea
                        rows={3}
                        value={propDescEn}
                        onChange={(e) => setPropDescEn(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Description (Français)
                      </label>
                      <textarea
                        rows={3}
                        value={propDescFr}
                        onChange={(e) => setPropDescFr(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Features Checkboxes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Property Features (Used by AI Service Suggestions)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FEATURE_OPTIONS.map((feat) => {
                        const active = propFeatures.includes(feat);
                        return (
                          <button
                            key={feat}
                            type="button"
                            onClick={() =>
                              setPropFeatures((prev) =>
                                prev.includes(feat)
                                  ? prev.filter((f) => f !== feat)
                                  : [...prev, feat]
                              )
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                              active
                                ? "bg-[#C85A32]/20 border-[#C85A32] text-[#F4A261]"
                                : "bg-[#131A24] border-slate-800 text-slate-400"
                            }`}
                          >
                            {feat.replace("_", " ")}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photos & Supabase Storage Upload */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Property Photos
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {propPhotos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative w-28 h-20 rounded-xl overflow-hidden border border-slate-700 group"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPropPhotos((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="url"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newPhotoUrl.trim()) {
                            setPropPhotos((prev) => [
                              ...prev,
                              newPhotoUrl.trim(),
                            ]);
                            setNewPhotoUrl("");
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Add Photo URL
                      </button>
                      <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[#F4A261]" />
                        <span>Upload Image</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingProp}
                    className="px-6 py-3 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-sm font-semibold transition"
                  >
                    {savingProp ? "Saving..." : "Save Property Changes"}
                  </button>
                </form>
              )}

              {/* TAB 3: QR CODE & NFC LINK */}
              {activeTab === "qr" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center max-w-4xl">
                  <div className="rounded-3xl bg-[#FAF6F0] text-[#1E1B18] p-6 text-center space-y-4 shadow-xl">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#C85A32] text-white">
                      Scan for Guest Services
                    </span>
                    <h3 className="font-serif text-2xl font-bold">
                      {property.name}
                    </h3>
                    <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-[#E2D4C3] flex items-center justify-center">
                      <img
                        src={`/api/admin/properties/${property.id}/qrcode?format=svg`}
                        alt={`QR Code for ${property.name}`}
                        className="w-full h-full"
                      />
                    </div>
                    <p className="text-xs text-[#5C4A3B] font-mono">
                      /stay/{property.slug}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-[#F4A261]" />
                        Download QR Code & Program NFC Card
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Place printed acrylic QR stands or NTAG215 NFC cards in
                        your property living room so guests can browse extra
                        services and request them on WhatsApp.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`/api/admin/properties/${property.id}/qrcode?format=png`}
                        download={`luxe-haven-${property.slug}-qr.png`}
                        className="px-4 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PNG QR Code</span>
                      </a>
                      <a
                        href={`/api/admin/properties/${property.id}/qrcode?format=svg`}
                        download={`luxe-haven-${property.slug}-qr.svg`}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Vector SVG</span>
                      </a>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#131A24] border border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-300">
                        Public Link for NFC Card Programming (NDEF URI Record)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={publicStayUrl}
                          className="flex-1 px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs font-mono text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(publicStayUrl);
                            setCopiedNfc(true);
                            setTimeout(() => setCopiedNfc(false), 2000);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-[#F4A261] inline-flex items-center gap-1.5"
                        >
                          {copiedNfc ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy NFC Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* SUB-MODAL 1: ADD SERVICES FROM REUSABLE CATALOGUE */}
      {showAddCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-[#131A24] border border-slate-700 text-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                Select Services from Catalogue
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCatalogModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3">
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search starter templates or organization custom services..."
                className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
              />
              <select
                value={catalogCatFilter}
                onChange={(e) => setCatalogCatFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {catalogServices
                .filter((sc) => {
                  if (
                    catalogCatFilter !== "all" &&
                    sc.category_key !== catalogCatFilter
                  ) {
                    return false;
                  }
                  if (catalogSearch.trim()) {
                    const q = catalogSearch.toLowerCase();
                    return (
                      sc.name_en.toLowerCase().includes(q) ||
                      sc.description_en.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((sc) => {
                  const checked = selectedCatalogIds.includes(sc.id);
                  return (
                    <label
                      key={sc.id}
                      className={`flex items-start justify-between gap-4 p-3.5 rounded-2xl border cursor-pointer transition ${
                        checked
                          ? "bg-[#C85A32]/15 border-[#C85A32]"
                          : "bg-[#0B0F17] border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedCatalogIds((prev) =>
                              prev.includes(sc.id)
                                ? prev.filter((id) => id !== sc.id)
                                : [...prev, sc.id]
                            )
                          }
                          className="mt-1"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">
                              {sc.name_en}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                sc.is_global_template
                                  ? "bg-slate-800 text-slate-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {sc.is_global_template
                                ? "Global Starter Template"
                                : "Org Custom Service"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {sc.description_en}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        {sc.default_pricing_mode === "fixed" &&
                        sc.suggested_price !== null ? (
                          <span className="font-bold text-[#F4A261]">
                            {sc.suggested_price} {sc.default_currency}
                          </span>
                        ) : (
                          <span className="text-amber-300">Quote</span>
                        )}
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {selectedCatalogIds.length} service(s) selected
              </span>
              <button
                type="button"
                disabled={
                  selectedCatalogIds.length === 0 || attachingCatalog
                }
                onClick={handleAttachSelectedCatalog}
                className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold disabled:opacity-40"
              >
                {attachingCatalog
                  ? "Attaching..."
                  : "Attach Selected to Property"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: AI-ASSISTED SERVICE SUGGESTIONS */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-[#131A24] border border-slate-700 text-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold">
                  AI-Assisted Service Suggestions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {aiLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-300">
                    Analyzing {propType} features ({propFeatures.join(", ")}) in{" "}
                    {propCity}...
                  </p>
                </div>
              ) : aiResponse ? (
                <>
                  {/* Provider Badge & Fallback Explanation */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-semibold ${
                            aiResponse.provider === "ai"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {aiResponse.provider === "ai"
                            ? "Live AI Model Suggestions"
                            : "Rule-Based Hospitality Suggestions (Fallback)"}
                        </span>
                      </div>
                      {aiResponse.fallback_reason && (
                        <p className="text-slate-400">
                          {aiResponse.fallback_reason}
                        </p>
                      )}
                      <p className="text-slate-400">
                        Select suggestions below and configure optional prices.
                        AI suggestions are never auto-activated without your
                        review.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {aiResponse.suggestions.map((sug) => {
                      const checked = selectedAiIds.includes(sug.id);
                      return (
                        <div
                          key={sug.id}
                          className={`p-4 rounded-2xl border transition ${
                            checked
                              ? "bg-[#C85A32]/15 border-[#C85A32]"
                              : "bg-[#0B0F17] border-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-start gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedAiIds((prev) =>
                                    prev.includes(sug.id)
                                      ? prev.filter((id) => id !== sug.id)
                                      : [...prev, sug.id]
                                  )
                                }
                                className="mt-1"
                              />
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-white">
                                    {sug.name_en}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] uppercase text-slate-300">
                                    {sug.category_key.replace("_", " ")}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      sug.matched_catalog_id
                                        ? "bg-emerald-500/20 text-emerald-300"
                                        : "bg-purple-500/20 text-purple-300"
                                    }`}
                                  >
                                    {sug.matched_catalog_id
                                      ? "Matched Existing Catalogue"
                                      : "New Tailored Proposal"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300">
                                  {sug.description_en}
                                </p>
                                <p className="text-xs text-[#F4A261]">
                                  <strong>Why it suits {property?.name}:</strong>{" "}
                                  {sug.reason_en}
                                </p>
                              </div>
                            </label>

                            {!sug.matched_catalog_id && (
                              <div className="w-32 shrink-0">
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Initial Price (MAD)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="Quote"
                                  value={customAiPrices[sug.id] || ""}
                                  onChange={(e) =>
                                    setCustomAiPrices((prev) => ({
                                      ...prev,
                                      [sug.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs text-white"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {selectedAiIds.length} suggestion(s) selected
              </span>
              <button
                type="button"
                disabled={selectedAiIds.length === 0 || addingAiSuggestions}
                onClick={handleAddSelectedAiSuggestions}
                className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold disabled:opacity-40"
              >
                {addingAiSuggestions
                  ? "Adding Selected Suggestions..."
                  : "Add Selected to Property"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: PROPERTY-SPECIFIC SERVICE CONFIGURATOR */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSaveEditedService}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#131A24] border border-slate-700 text-white shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#F4A261] font-semibold">
                  Property-Specific Service Configuration ({property?.name})
                </span>
                <h3 className="text-lg font-bold">{editingService.name_en}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {serviceError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                  {serviceError}
                </div>
              )}

              {/* Active Toggle & Pricing Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#0B0F17] border border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.is_active}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  <span className="text-xs font-bold text-white">
                    Active on Guest Page
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Pricing Mode
                  </label>
                  <select
                    value={editingService.pricing_mode}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        pricing_mode: e.target.value as PricingMode,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs text-white"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="quote">Quote Required</option>
                  </select>
                </div>

                {editingService.pricing_mode === "fixed" && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Price ({editingService.currency}) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={editingService.price ?? 0}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          price: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs font-bold text-[#F4A261]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Pricing Unit
                  </label>
                  <select
                    value={editingService.pricing_unit}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        pricing_unit: e.target.value as PricingUnit,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs text-white"
                  >
                    <option value="per_booking">Per Booking</option>
                    <option value="per_person">Per Person</option>
                    <option value="per_hour">Per Hour</option>
                    <option value="per_night">Per Night</option>
                    <option value="per_item">Per Item</option>
                  </select>
                </div>
              </div>

              {/* Names & Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Display Name (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingService.name_en}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        name_en: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Display Name (FR)
                  </label>
                  <input
                    type="text"
                    value={editingService.name_fr}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        name_fr: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Description (EN)
                  </label>
                  <textarea
                    rows={2}
                    value={editingService.description_en}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        description_en: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Conditions / Instructions (EN)
                  </label>
                  <textarea
                    rows={2}
                    value={editingService.conditions_en}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        conditions_en: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* Quantities, Advance Notice, Display Order */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Min Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingService.min_quantity}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        min_quantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Max Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingService.max_quantity}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        max_quantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Advance Notice (h)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.advance_notice_hours}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        advance_notice_hours: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingService.display_order}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        display_order: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.requires_time_slot}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        requires_time_slot: e.target.checked,
                      })
                    }
                  />
                  <span>Require Time</span>
                </label>
              </div>

              {/* WhatsApp Recipient Override Section */}
              <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    WhatsApp Recipient Override (Optional)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Leave blank to route to Property Default (
                    {property?.default_whatsapp})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editingService.whatsapp_override || ""}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        whatsapp_override: e.target.value,
                      })
                    }
                    placeholder="+212600000011 (Leave empty for property default)"
                    className="px-3 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs font-mono text-white"
                  />
                  <input
                    type="text"
                    value={editingService.whatsapp_override_label || ""}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        whatsapp_override_label: e.target.value,
                      })
                    }
                    placeholder="Provider Name (e.g. Fatima — Kitchen Partner)"
                    className="px-3 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* Weekday Availability Windows */}
              <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#F4A261]" />
                  Available Weekdays & Local Requestable Time Windows (
                  {property?.timezone})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {editingService.availability.map((win, idx) => (
                    <div
                      key={win.weekday}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#131A24] border border-slate-800 text-xs"
                    >
                      <label className="flex items-center gap-2 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={win.is_available}
                          onChange={(e) => {
                            const next = [...editingService.availability];
                            next[idx] = {
                              ...win,
                              is_available: e.target.checked,
                            };
                            setEditingService({
                              ...editingService,
                              availability: next,
                            });
                          }}
                        />
                        <span>{WEEKDAY_NAMES[win.weekday]}</span>
                      </label>
                      {win.is_available ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={win.start_time.slice(0, 5)}
                            onChange={(e) => {
                              const next = [...editingService.availability];
                              next[idx] = {
                                ...win,
                                start_time: e.target.value,
                              };
                              setEditingService({
                                ...editingService,
                                availability: next,
                              });
                            }}
                            className="px-2 py-1 rounded bg-[#0B0F17] border border-slate-700 text-[11px]"
                          />
                          <span>–</span>
                          <input
                            type="time"
                            value={win.end_time.slice(0, 5)}
                            onChange={(e) => {
                              const next = [...editingService.availability];
                              next[idx] = { ...win, end_time: e.target.value };
                              setEditingService({
                                ...editingService,
                                availability: next,
                              });
                            }}
                            className="px-2 py-1 rounded bg-[#0B0F17] border border-slate-700 text-[11px]"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Blackout Dates */}
              <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white">
                  Unavailable / Blackout Dates
                </span>
                <div className="flex flex-wrap gap-2">
                  {editingService.blackouts.map((blk, idx) => (
                    <span
                      key={blk.unavailable_date}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs"
                    >
                      <span>
                        {blk.unavailable_date}
                        {blk.reason ? ` (${blk.reason})` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingService({
                            ...editingService,
                            blackouts: editingService.blackouts.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={newBlackoutDate}
                    onChange={(e) => setNewBlackoutDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newBlackoutReason}
                    onChange={(e) => setNewBlackoutReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="px-3 py-1.5 rounded-lg bg-[#131A24] border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newBlackoutDate) {
                        setEditingService({
                          ...editingService,
                          blackouts: [
                            ...editingService.blackouts,
                            {
                              id: `blk-${Date.now()}`,
                              property_service_id: editingService.id,
                              unavailable_date: newBlackoutDate,
                              reason: newBlackoutReason,
                            },
                          ],
                        });
                        setNewBlackoutDate("");
                        setNewBlackoutReason("");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                  >
                    + Add Blackout Date
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingService}
                className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold"
              >
                {savingService
                  ? "Saving..."
                  : "Save Property Service Configuration"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
