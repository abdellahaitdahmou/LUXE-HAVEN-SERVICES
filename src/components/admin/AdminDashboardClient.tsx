"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandLogo";
import {
  AuthenticatedActor,
  OrganizationMember,
  PricingMode,
  PricingUnit,
  Property,
  PropertyService,
  PropertyStatus,
  PropertyType,
  RequestStatus,
  ServiceCatalogItem,
  ServiceCategory,
  ServiceRequest,
} from "@/lib/types";
import {
  formatPricingUnitBadge,
  formatPropertyTypeLabel,
  formatRequestStatusInfo,
} from "@/lib/i18n";
import { PropertyWorkspaceModal } from "./PropertyWorkspaceModal";
import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

interface DashboardPayload {
  actor: AuthenticatedActor;
  categories: ServiceCategory[];
  properties: Property[];
  allOrgPropertiesCount: number;
  propertyServices: PropertyService[];
  catalogServices: ServiceCatalogItem[];
  requests: ServiceRequest[];
  orgMembers: (OrganizationMember & {
    profile: {
      id: string;
      email: string;
      full_name: string;
    };
    assignedPropertyIds: string[];
  })[];
  metrics: {
    activePropertiesCount: number;
    activePropertyServicesCount: number;
    requestsPreparedCount: number;
    confirmedRequestsCount: number;
    estimatedConfirmedValue: number;
    currency: string;
  };
}

type NavSection =
  | "overview"
  | "properties"
  | "catalog"
  | "requests"
  | "team"
  | "settings";

export function AdminDashboardClient({
  initialData,
}: {
  initialData: DashboardPayload;
}) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [activeNav, setActiveNav] = useState<NavSection>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Active property workspace modal
  const [workspacePropertyId, setWorkspacePropertyId] = useState<string | null>(
    null
  );

  // Create Property Modal state
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [newPropSlug, setNewPropSlug] = useState("");
  const [newPropType, setNewPropType] = useState<PropertyType>("riad");
  const [newPropCity, setNewPropCity] = useState("Marrakech");
  const [newPropWhatsapp, setNewPropWhatsapp] = useState("+212600000099");
  const [newPropStatus, setNewPropStatus] =
    useState<PropertyStatus>("published");
  const [newPropFeatures, setNewPropFeatures] = useState<string[]>([
    "pool",
    "hammam",
    "kitchen",
  ]);
  const [creatingProp, setCreatingProp] = useState(false);
  const [createPropError, setCreatePropError] = useState<string | null>(null);

  // Airbnb import state (paste a listing link to auto-fill the form)
  const [airbnbUrl, setAirbnbUrl] = useState("");
  const [importingAirbnb, setImportingAirbnb] = useState(false);
  const [importedListing, setImportedListing] = useState<{
    source_url: string;
    description_en: string;
    description_fr: string;
    photos: string[];
    map_url: string | null;
  } | null>(null);

  // Hostaway API full-account sync state
  const [showHostawayModal, setShowHostawayModal] = useState(false);
  const [hostawayAccountId, setHostawayAccountId] = useState(
    data.actor.organization.hostaway_account_id || ""
  );
  const [hostawayApiKey, setHostawayApiKey] = useState("");
  const [hostawayDefaultWhatsapp, setHostawayDefaultWhatsapp] = useState(
    data.properties[0]?.default_whatsapp || "+212600000099"
  );
  const [syncingHostaway, setSyncingHostaway] = useState(false);
  const [hostawayError, setHostawayError] = useState<string | null>(null);

  // Service Catalogue filters & Create Custom Service state
  const [catSearch, setCatSearch] = useState("");
  const [catCategoryFilter, setCatCategoryFilter] = useState("all");
  const [catScopeFilter, setCatScopeFilter] = useState<
    "all" | "global" | "org"
  >("all");
  const [showCreateCatalogModal, setShowCreateCatalogModal] = useState(false);
  const [custNameEn, setCustNameEn] = useState("");
  const [custNameFr, setCustNameFr] = useState("");
  const [custCategory, setCustCategory] = useState("activities");
  const [custDescEn, setCustDescEn] = useState("");
  const [custDescFr, setCustDescFr] = useState("");
  const [custPricingMode, setCustPricingMode] = useState<PricingMode>("fixed");
  const [custPrice, setCustPrice] = useState("350");
  const [custUnit, setCustUnit] = useState<PricingUnit>("per_person");
  const [custAdvanceHours, setCustAdvanceHours] = useState("24");
  const [custAttachPropertyId, setCustAttachPropertyId] = useState("");
  const [duplicateWarningList, setDuplicateWarningList] = useState<
    { id: string; name_en: string; is_global_template: boolean }[] | null
  >(null);
  const [creatingCustomSvc, setCreatingCustomSvc] = useState(false);
  const [customSvcError, setCustomSvcError] = useState<string | null>(null);

  // Requests Filter state
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("all");
  const [reqPropertyFilter, setReqPropertyFilter] = useState<string>("all");
  const [updatingReqId, setUpdatingReqId] = useState<string | null>(null);

  // Team Invite state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"property_manager" | "admin">(
    "property_manager"
  );
  const [invitingMember, setInvitingMember] = useState(false);

  // Organization Settings state
  const [orgName, setOrgName] = useState(data.actor.organization.name);
  const [orgEmail, setOrgEmail] = useState(
    data.actor.organization.contact_email || ""
  );
  const [orgCurrency, setOrgCurrency] = useState(
    data.actor.organization.default_currency
  );
  const [orgTimezone, setOrgTimezone] = useState(
    data.actor.organization.default_timezone
  );
  const [orgLang, setOrgLang] = useState(
    data.actor.organization.default_language
  );
  const [savingOrg, setSavingOrg] = useState(false);

  // Copy NFC link feedback
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const showToastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.ok) {
        const next: DashboardPayload = await res.json();
        setData(next);
        setOrgName(next.actor.organization.name);
        setOrgEmail(next.actor.organization.contact_email || "");
        setOrgCurrency(next.actor.organization.default_currency);
        setOrgTimezone(next.actor.organization.default_timezone);
        setOrgLang(next.actor.organization.default_language);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Sync state if initialData updates
    setData(initialData);
  }, [initialData]);

  const handleSignOut = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      window.location.href = "/login";
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncHostaway = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSyncingHostaway(true);
    setHostawayError(null);
    try {
      const res = await fetch("/api/admin/hostaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: hostawayAccountId.trim() || undefined,
          apiKey: hostawayApiKey.trim() || undefined,
          defaultWhatsapp: hostawayDefaultWhatsapp.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHostawayError(payload.error || "Failed to sync from Hostaway.");
        return;
      }
      setHostawayApiKey("");
      setShowHostawayModal(false);
      await refreshDashboard();
      showToastMessage(
        `Synced ${payload.syncedCount} Hostaway listing(s): ${payload.createdCount} added, ${payload.updatedCount} updated.`
      );
    } catch {
      setHostawayError("Failed to connect to Hostaway sync endpoint.");
    } finally {
      setSyncingHostaway(false);
    }
  };

  /**
   * Fetches an Airbnb listing and fills the form (name, slug, city, type,
   * description, cover photo + gallery, features, map link).
   * Returns the imported values so callers don't depend on async state updates.
   */
  const importFromAirbnb = async (urlOverride?: string) => {
    const url = (urlOverride ?? airbnbUrl).trim();
    if (!url) return null;
    setImportingAirbnb(true);
    setCreatePropError(null);
    try {
      const res = await fetch("/api/admin/import-airbnb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const out = await res.json();
      if (!res.ok) {
        setImportedListing(null);
        setCreatePropError(out.error || "Failed to import from Airbnb.");
        return null;
      }
      const l = out.listing;
      setNewPropName(l.name);
      setNewPropSlug(l.slug);
      if (l.city) setNewPropCity(l.city);
      setNewPropType(l.property_type);
      setNewPropFeatures(l.features);
      setImportedListing({
        source_url: l.source_url,
        description_en: l.description_en,
        description_fr: l.description_fr,
        photos: l.photos,
        map_url: l.map_url,
      });
      return l as {
        name: string;
        slug: string;
        city: string;
        property_type: PropertyType;
        features: string[];
        source_url: string;
        description_en: string;
        description_fr: string;
        photos: string[];
        map_url: string | null;
      };
    } catch {
      setCreatePropError("Failed to import from Airbnb.");
      return null;
    } finally {
      setImportingAirbnb(false);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProp(true);
    setCreatePropError(null);

    try {
      // If a link was pasted but not imported yet, import it first.
      let imported = importedListing;
      let name = newPropName;
      let slug = newPropSlug;
      let city = newPropCity;
      let propType = newPropType;
      let features = newPropFeatures;
      if (airbnbUrl.trim() && !imported) {
        const l = await importFromAirbnb();
        if (!l) return;
        imported = l;
        name = l.name;
        slug = l.slug;
        city = l.city || newPropCity;
        propType = l.property_type;
        features = l.features;
      }

      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          property_type: propType,
          city,
          default_whatsapp: newPropWhatsapp,
          // Server still flags placeholder numbers (+212600000...) as demo.
          is_demo_contact: false,
          status: newPropStatus,
          features,
          timezone: "Africa/Casablanca",
          currency: "MAD",
          description_en:
            imported?.description_en ||
            `Authentic Moroccan ${propType} in ${city} with curated in-stay services.`,
          description_fr:
            imported?.description_fr ||
            `Magnifique ${propType} à ${city} avec services de conciergerie à la carte.`,
          ...(imported?.photos?.length ? { photos: imported.photos } : {}),
          ...(imported?.map_url ? { map_url: imported.map_url } : {}),
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        setCreatePropError(out.error || "Failed to create property.");
      } else {
        setShowCreateProperty(false);
        setNewPropName("");
        setNewPropSlug("");
        setAirbnbUrl("");
        setImportedListing(null);
        await refreshDashboard();
        setWorkspacePropertyId(out.property.id);
        showToastMessage(`Property "${out.property.name}" created!`);
      }
    } finally {
      setCreatingProp(false);
    }
  };

  const handleCreateCustomService = async (ignoreDuplicate = false) => {
    setCreatingCustomSvc(true);
    setCustomSvcError(null);
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_key: custCategory,
          name_en: custNameEn,
          name_fr: custNameFr || custNameEn,
          description_en: custDescEn,
          description_fr: custDescFr || custDescEn,
          default_pricing_mode: custPricingMode,
          suggested_price:
            custPricingMode === "fixed" ? Number(custPrice || 0) : null,
          default_currency: "MAD",
          default_pricing_unit: custUnit,
          default_min_quantity: 1,
          default_max_quantity: 10,
          default_advance_notice_hours: Number(custAdvanceHours || 12),
          requires_time_slot: true,
          save_to_org_catalog: true,
          ignore_duplicate_warning: ignoreDuplicate,
          attachToPropertyId: custAttachPropertyId || null,
        }),
      });

      const out = await res.json();
      if (res.status === 409 && out.status === "duplicate_warning") {
        setDuplicateWarningList(out.duplicates || []);
        return;
      }

      if (!res.ok) {
        setCustomSvcError(out.error || "Could not create custom service.");
        return;
      }

      setShowCreateCatalogModal(false);
      setDuplicateWarningList(null);
      setCustNameEn("");
      setCustNameFr("");
      setCustDescEn("");
      setCustDescFr("");
      await refreshDashboard();
      showToastMessage(
        "Custom service saved to your organization's reusable catalogue!"
      );
    } finally {
      setCreatingCustomSvc(false);
    }
  };

  const handleQuickAttachCatalogItemToProperty = async (
    catalogServiceId: string,
    propertyId: string
  ) => {
    if (!propertyId) return;
    const res = await fetch(`/api/admin/properties/${propertyId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogServiceIds: [catalogServiceId] }),
    });
    if (res.ok) {
      await refreshDashboard();
      showToastMessage("Service attached to property!");
    } else {
      const err = await res.json();
      showToastMessage(err.error || "Failed to attach service.");
    }
  };

  const handleUpdateRequestStatus = async (
    requestId: string,
    status: RequestStatus,
    managerNotes?: string
  ) => {
    setUpdatingReqId(requestId);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, manager_notes: managerNotes }),
      });
      if (res.ok) {
        await refreshDashboard();
        showToastMessage(`Request status updated to ${status.toUpperCase()}.`);
      }
    } finally {
      setUpdatingReqId(null);
    }
  };

  const handleToggleManagerPropertyAssignment = async (
    userId: string,
    currentAssignedIds: string[],
    propertyId: string
  ) => {
    const nextIds = currentAssignedIds.includes(propertyId)
      ? currentAssignedIds.filter((id) => id !== propertyId)
      : [...currentAssignedIds, propertyId];

    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_assignments",
        userId,
        propertyIds: nextIds,
      }),
    });

    if (res.ok) {
      await refreshDashboard();
      showToastMessage("Updated property assignments for manager.");
    } else {
      const err = await res.json();
      showToastMessage(err.error || "Failed to update assignments.");
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitingMember(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_member",
          full_name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          assignedPropertyIds:
            inviteRole === "property_manager" && data.properties[0]
              ? [data.properties[0].id]
              : [],
        }),
      });
      if (res.ok) {
        const invited = await res.json().catch(() => ({}));
        setInviteName("");
        setInviteEmail("");
        await refreshDashboard();
        showToastMessage(
          invited?.temporaryPassword
            ? `Team member added. Temporary password: ${invited.temporaryPassword}`
            : "Team member added to organization."
        );
      } else {
        const out = await res.json();
        showToastMessage(out.error || "Could not invite team member.");
      }
    } finally {
      setInvitingMember(false);
    }
  };

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      const res = await fetch("/api/admin/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          contact_email: orgEmail,
          default_currency: orgCurrency,
          default_timezone: orgTimezone,
          default_language: orgLang,
        }),
      });
      if (res.ok) {
        await refreshDashboard();
        showToastMessage("Organization settings updated.");
      } else {
        const out = await res.json();
        showToastMessage(out.error || "Permission denied.");
      }
    } finally {
      setSavingOrg(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    return data.catalogServices.filter((sc) => {
      if (catScopeFilter === "global" && !sc.is_global_template) return false;
      if (catScopeFilter === "org" && sc.is_global_template) return false;
      if (
        catCategoryFilter !== "all" &&
        sc.category_key !== catCategoryFilter
      ) {
        return false;
      }
      if (catSearch.trim()) {
        const q = catSearch.toLowerCase();
        return (
          sc.name_en.toLowerCase().includes(q) ||
          sc.name_fr.toLowerCase().includes(q) ||
          sc.description_en.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.catalogServices, catScopeFilter, catCategoryFilter, catSearch]);

  const filteredRequests = useMemo(() => {
    return data.requests.filter((r) => {
      if (reqStatusFilter !== "all" && r.status !== reqStatusFilter) {
        return false;
      }
      if (reqPropertyFilter !== "all" && r.property_id !== reqPropertyFilter) {
        return false;
      }
      return true;
    });
  }, [data.requests, reqStatusFilter, reqPropertyFilter]);

  const isAdmin = data.actor.membership.role === "admin";

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-[#C85A32] text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Bar with Role/Organization Switcher & Quick Links */}
      <header className="sticky top-0 z-30 bg-[#0F141C]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5">
              <BrandMark size={36} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-lg tracking-wide text-white">
                    LUXE HAVEN
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-semibold uppercase tracking-wider text-[#F4A261]">
                    Management Console
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {data.actor.organization.name} ·{" "}
                  <span className="text-emerald-400 font-semibold">
                    {isAdmin ? "Organization Admin" : "Property Manager"}
                  </span>
                </p>
              </div>
            </a>
          </div>

          {/* Active Account & Session Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#131A24] border border-slate-800 rounded-xl px-3 py-1.5">
              <ShieldCheck className="w-4 h-4 text-[#F4A261]" />
              <span className="text-xs font-semibold text-white">
                {data.actor.user.email}
              </span>
            </div>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
              title="Refresh data"
              className="p-2 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-slate-800 text-slate-300"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar + Content Area */}
      <div className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 sm:px-6 py-6">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-4">
          <nav className="rounded-3xl bg-[#0F141C] border border-slate-800/80 p-3 space-y-1">
            {(
              [
                {
                  id: "overview",
                  label: "Overview",
                  icon: LayoutDashboard,
                },
                {
                  id: "properties",
                  label: `Properties (${data.properties.length})`,
                  icon: Building2,
                },
                {
                  id: "catalog",
                  label: `Service Catalogue (${data.catalogServices.length})`,
                  icon: FolderKanban,
                },
                {
                  id: "requests",
                  label: `Requests (${data.requests.length})`,
                  icon: ClipboardList,
                },
                {
                  id: "team",
                  label: "Team & Assignments",
                  icon: Users,
                },
                {
                  id: "settings",
                  label: "Organization Settings",
                  icon: Settings,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition ${
                    active
                      ? "bg-[#C85A32] text-white shadow-md"
                      : "text-slate-400 hover:bg-[#131A24] hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Public Guest Pages Box */}
          <div className="rounded-3xl bg-[#0F141C] border border-slate-800/80 p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F4A261]">
              Live Guest Pages (/stay/[slug])
            </span>
            <div className="space-y-2">
              {data.properties
                .filter((p) => p.status === "published")
                .map((prop) => (
                  <a
                    key={prop.id}
                    href={`/stay/${prop.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-slate-800/80 text-xs transition"
                  >
                    <div>
                      <p className="font-semibold text-white">{prop.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        /stay/{prop.slug}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#F4A261]" />
                  </a>
                ))}
            </div>
          </div>
        </aside>

        {/* Main Content Column */}
        <main className="lg:col-span-9 space-y-6">
          {/* Property Manager Access Notice Banner */}
          {!isAdmin && (
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Signed in as <strong>Property Manager</strong> (
                  {data.actor.user.full_name}). You have access to{" "}
                  <strong>
                    {data.properties.length} of {data.allOrgPropertiesCount}
                  </strong>{" "}
                  properties in {data.actor.organization.name}. Unassigned
                  properties and organization-wide settings are restricted.
                </span>
              </div>
            </div>
          )}

          {/* SECTION 1: OVERVIEW */}
          {activeNav === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Hospitality Operations Overview
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time metrics calculated from your organization’s active
                  properties, services, and guest requests.
                </p>
              </div>

              {/* 5 Required Overview Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-2xl bg-[#0F141C] border border-slate-800 p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Active Properties
                  </span>
                  <p className="text-2xl font-bold text-white">
                    {data.metrics.activePropertiesCount}
                  </p>
                  <p className="text-[11px] text-emerald-400">
                    Published guest pages
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0F141C] border border-slate-800 p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Active Property Services
                  </span>
                  <p className="text-2xl font-bold text-white">
                    {data.metrics.activePropertyServicesCount}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Bookable across properties
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0F141C] border border-slate-800 p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-amber-300">
                    Requests Prepared
                  </span>
                  <p className="text-2xl font-bold text-amber-300">
                    {data.metrics.requestsPreparedCount}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Saved before handoff (does not prove WhatsApp send)
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0F141C] border border-slate-800 p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-300">
                    Confirmed Requests
                  </span>
                  <p className="text-2xl font-bold text-emerald-300">
                    {data.metrics.confirmedRequestsCount}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Confirmed with guest
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0F141C] border border-[#C85A32]/40 p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#F4A261]">
                    Est. Value (Confirmed)
                  </span>
                  <p className="text-2xl font-bold text-[#F4A261]">
                    {data.metrics.estimatedConfirmedValue}{" "}
                    {data.metrics.currency}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Estimated request value (not collected revenue)
                  </p>
                </div>
              </div>

              {/* Properties Quick Grid */}
              <div className="rounded-3xl bg-[#0F141C] border border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Managed Properties
                    </h2>
                    <p className="text-xs text-slate-400">
                      Click any property to configure its services, prices, AI
                      suggestions, WhatsApp routing, or QR code.
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHostawayError(null);
                          setShowHostawayModal(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-[#F4A261]/40 text-[#F4A261] text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sync Hostaway</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateProperty(true)}
                        className="px-4 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Property</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.properties.map((prop) => {
                    const propServices = data.propertyServices.filter(
                      (ps) => ps.property_id === prop.id
                    );
                    const activeCount = propServices.filter(
                      (ps) => ps.is_active
                    ).length;

                    return (
                      <div
                        key={prop.id}
                        className="rounded-2xl bg-[#131A24] border border-slate-800 overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-36 w-full relative bg-slate-900">
                            <img
                              src={
                                prop.photos[0] ||
                                "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80"
                              }
                              alt={prop.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <span
                              className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                prop.status === "published"
                                  ? "bg-emerald-500/90 text-white"
                                  : "bg-slate-800/90 text-slate-300"
                              }`}
                            >
                              {prop.status}
                            </span>
                            <div className="absolute bottom-3 left-3 right-3 text-white">
                              <p className="font-bold text-sm">{prop.name}</p>
                              <p className="text-[11px] text-white/80">
                                {prop.city} ·{" "}
                                {formatPropertyTypeLabel(
                                  prop.property_type,
                                  "en"
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="p-4 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Active Services:</span>
                              <span className="font-bold text-[#F4A261]">
                                {activeCount} / {propServices.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Default WhatsApp:</span>
                              <span className="font-mono text-slate-200">
                                {prop.default_whatsapp}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pt-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWorkspacePropertyId(prop.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold transition"
                          >
                            Manage Services & QR
                          </button>
                          <a
                            href={`/stay/${prop.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View guest page"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Requests Preview */}
              <div className="rounded-3xl bg-[#0F141C] border border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Recent Service Requests
                    </h2>
                    <p className="text-xs text-slate-400">
                      “Prepared” means the request was saved before opening
                      WhatsApp; confirm with the guest or provider before
                      marking Confirmed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav("requests")}
                    className="text-xs font-semibold text-[#F4A261] hover:underline"
                  >
                    View All Requests →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">Ref</th>
                        <th className="py-2.5 px-3">Guest & Property</th>
                        <th className="py-2.5 px-3">Service & Slot</th>
                        <th className="py-2.5 px-3">Est. Total</th>
                        <th className="py-2.5 px-3">Effective Recipient</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.requests.slice(0, 5).map((req) => {
                        const statusInfo = formatRequestStatusInfo(req.status);
                        return (
                          <tr key={req.id} className="hover:bg-[#131A24]/60">
                            <td className="py-3 px-3 font-mono font-bold text-[#F4A261]">
                              {req.reference_code}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-white">
                                {req.guest_name}
                              </p>
                              <p className="text-slate-400">
                                {req.property_name_snapshot}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-200">
                                {req.service_name_snapshot} (x{req.quantity})
                              </p>
                              <p className="text-slate-400">
                                {req.requested_date}
                                {req.requested_time
                                  ? ` at ${req.requested_time}`
                                  : ""}
                              </p>
                            </td>
                            <td className="py-3 px-3 font-semibold text-white">
                              {req.estimated_total !== null
                                ? `${req.estimated_total} ${req.currency}`
                                : "Quote Required"}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-mono text-slate-200">
                                {req.resolved_whatsapp_number}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {req.used_override_recipient
                                  ? "Service Override"
                                  : "Property Default"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusInfo.badgeClass}`}
                              >
                                {statusInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PROPERTIES */}
          {activeNav === "properties" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">Properties</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage properties, public `/stay/[slug]` pages, QR codes,
                    NFC links, and property-specific services.
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHostawayError(null);
                        setShowHostawayModal(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-[#F4A261]/40 text-[#F4A261] text-xs font-semibold inline-flex items-center gap-2 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Sync from Hostaway</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateProperty(true)}
                      className="px-4 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Property</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {data.properties.map((prop) => {
                  const attached = data.propertyServices.filter(
                    (ps) => ps.property_id === prop.id
                  );
                  return (
                    <div
                      key={prop.id}
                      className="rounded-3xl bg-[#0F141C] border border-slate-800 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={
                            prop.photos[0] ||
                            "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80"
                          }
                          alt={prop.name}
                          className="w-24 h-24 rounded-2xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                prop.status === "published"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {prop.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              {prop.city} ·{" "}
                              {formatPropertyTypeLabel(
                                prop.property_type,
                                "en"
                              )}
                            </span>
                            <code className="text-xs font-mono text-[#F4A261] bg-[#131A24] px-2 py-0.5 rounded">
                              /stay/{prop.slug}
                            </code>
                          </div>

                          <h3 className="text-lg font-bold text-white">
                            {prop.name}
                          </h3>

                          <p className="text-xs text-slate-400 max-w-xl line-clamp-2">
                            {prop.description_en}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                              Default Host:{" "}
                              <strong className="font-mono">
                                {prop.default_whatsapp}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>
                              <strong>{attached.length}</strong> attached
                              services
                            </span>
                            <span>·</span>
                            <span>
                              {prop.currency} ({prop.timezone})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/stay/${prop.slug}`;
                            navigator.clipboard.writeText(url);
                            setCopiedSlug(prop.slug);
                            setTimeout(() => setCopiedSlug(null), 2000);
                          }}
                          className="px-3 py-2 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
                        >
                          {copiedSlug === prop.slug ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied NFC Link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#F4A261]" />
                              <span>Copy NFC Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`/api/admin/properties/${prop.id}/qrcode?format=png`}
                          download={`luxe-haven-${prop.slug}-qr.png`}
                          className="px-3 py-2 rounded-xl bg-[#131A24] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#F4A261]" />
                          <span>QR</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setWorkspacePropertyId(prop.id)}
                          className="px-4 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold"
                        >
                          Configure Property & Services
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: REUSABLE SERVICE CATALOGUE */}
          {activeNav === "catalog" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Reusable Service Catalogue
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Global starter templates (12) are separated from your
                    organization’s custom services. Custom services are strictly
                    isolated to <strong>{data.actor.organization.name}</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarningList(null);
                    setCustomSvcError(null);
                    setShowCreateCatalogModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Custom Service</span>
                </button>
              </div>

              {/* Search & Scope/Category Filters */}
              <div className="rounded-2xl bg-[#0F141C] border border-slate-800 p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Search services by name or description..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                  />
                </div>

                <select
                  value={catScopeFilter}
                  onChange={(e) =>
                    setCatScopeFilter(
                      e.target.value as "all" | "global" | "org"
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                >
                  <option value="all">
                    All Templates ({data.catalogServices.length})
                  </option>
                  <option value="global">Global Starter Templates</option>
                  <option value="org">
                    Organization Custom Services ({data.actor.organization.name}
                    )
                  </option>
                </select>

                <select
                  value={catCategoryFilter}
                  onChange={(e) => setCatCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                >
                  <option value="all">All Categories</option>
                  {data.categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Catalogue Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCatalog.map((sc) => (
                  <div
                    key={sc.id}
                    className="rounded-2xl bg-[#0F141C] border border-slate-800 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            sc.is_global_template
                              ? "bg-slate-800 text-slate-300"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {sc.is_global_template
                            ? "Global Starter Template"
                            : `Custom · ${data.actor.organization.name}`}
                        </span>
                        <span className="text-xs font-bold text-[#F4A261]">
                          {sc.default_pricing_mode === "fixed" &&
                          sc.suggested_price !== null
                            ? `${sc.suggested_price} ${
                                sc.default_currency
                              } (${formatPricingUnitBadge(
                                sc.default_pricing_unit,
                                "en"
                              )})`
                            : "Quote Required"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {sc.name_en}
                      </h3>
                      {sc.name_fr && (
                        <p className="text-xs text-slate-400">
                          FR: {sc.name_fr}
                        </p>
                      )}
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {sc.description_en}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 uppercase">
                        Category: {sc.category_key.replace("_", " ")}
                      </span>

                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickAttachCatalogItemToProperty(
                              sc.id,
                              e.target.value
                            );
                            e.target.value = "";
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#131A24] border border-slate-700 text-xs font-semibold text-[#F4A261] cursor-pointer"
                      >
                        <option value="" disabled>
                          + Reuse on Property...
                        </option>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            Attach to {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: SERVICE REQUESTS */}
          {activeNav === "requests" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Guest Service Requests
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Requests are saved with status <strong>Prepared</strong>{" "}
                    before opening WhatsApp. Note: “Prepared” does not prove the
                    guest sent the WhatsApp message. Update the status below
                    after confirming with the guest or provider.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={reqPropertyFilter}
                    onChange={(e) => setReqPropertyFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#0F141C] border border-slate-800 text-xs text-white"
                  >
                    <option value="all">All Accessible Properties</option>
                    {data.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={reqStatusFilter}
                    onChange={(e) => setReqStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#0F141C] border border-slate-800 text-xs text-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="prepared">Prepared</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="declined">Declined</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredRequests.map((req) => {
                  const statusInfo = formatRequestStatusInfo(req.status);
                  return (
                    <div
                      key={req.id}
                      className="rounded-3xl bg-[#0F141C] border border-slate-800 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="px-2.5 py-0.5 rounded-lg bg-[#131A24] border border-slate-700 font-mono text-xs font-bold text-[#F4A261]">
                              {req.reference_code}
                            </code>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}
                            >
                              {statusInfo.label}
                            </span>
                            <span className="text-xs text-slate-400">
                              Handoff recorded:{" "}
                              {req.whatsapp_handoff_at
                                ? new Date(
                                    req.whatsapp_handoff_at
                                  ).toLocaleString()
                                : "N/A"}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white pt-1">
                            {req.service_name_snapshot} —{" "}
                            <span className="text-[#F4A261]">
                              {req.property_name_snapshot}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-300">
                            Guest: <strong>{req.guest_name}</strong> · Date:{" "}
                            <strong>{req.requested_date}</strong>
                            {req.requested_time
                              ? ` at ${req.requested_time}`
                              : ""}{" "}
                            · Quantity: <strong>{req.quantity}</strong> (
                            {formatPricingUnitBadge(
                              req.pricing_unit_snapshot,
                              "en"
                            )}
                            )
                          </p>
                          {req.guest_note && (
                            <p className="text-xs text-amber-200/90 italic">
                              Guest Note: “{req.guest_note}”
                            </p>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold text-white">
                            {req.estimated_total !== null
                              ? `${req.estimated_total} ${req.currency}`
                              : "Quote Required"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Routed to:{" "}
                            <span className="font-mono text-slate-200">
                              {req.resolved_whatsapp_number}
                            </span>{" "}
                            ({req.resolved_whatsapp_label})
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-400">
                          {statusInfo.description}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Update Status:
                          </span>
                          {(
                            [
                              "prepared",
                              "confirmed",
                              "completed",
                              "declined",
                              "cancelled",
                            ] as RequestStatus[]
                          ).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={
                                updatingReqId === req.id || req.status === st
                              }
                              onClick={() =>
                                handleUpdateRequestStatus(req.id, st)
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                                req.status === st
                                  ? "bg-[#C85A32] text-white"
                                  : "bg-[#131A24] hover:bg-slate-800 text-slate-300 border border-slate-800"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5: TEAM & PROPERTY ASSIGNMENTS */}
          {activeNav === "team" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Team & Property Assignments
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Admins manage all properties in{" "}
                  <strong>{data.actor.organization.name}</strong>. Property
                  managers can only view and manage properties explicitly
                  assigned to them below.
                </p>
              </div>

              <div className="space-y-4">
                {data.orgMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-3xl bg-[#0F141C] border border-slate-800 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            {member.profile.full_name}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              member.role === "admin"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {member.role.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {member.profile.email}
                        </p>
                      </div>
                    </div>

                    {member.role === "admin" ? (
                      <p className="text-xs text-slate-400">
                        Organization Administrators automatically have full
                        access to all properties in the organization.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-300">
                          Assigned Properties (Check to grant access):
                        </span>
                        <div className="flex flex-wrap gap-2.5">
                          {data.properties.map((prop) => {
                            const assigned =
                              member.assignedPropertyIds.includes(prop.id);
                            return (
                              <label
                                key={prop.id}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                                  assigned
                                    ? "bg-[#C85A32]/20 border-[#C85A32] text-[#F4A261]"
                                    : "bg-[#131A24] border-slate-800 text-slate-400"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!isAdmin}
                                  checked={assigned}
                                  onChange={() =>
                                    handleToggleManagerPropertyAssignment(
                                      member.user_id,
                                      member.assignedPropertyIds,
                                      prop.id
                                    )
                                  }
                                />
                                <span>
                                  {prop.name} ({prop.city})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleInviteMember}
                  className="rounded-3xl bg-[#0F141C] border border-slate-800 p-6 space-y-4 max-w-2xl"
                >
                  <h3 className="text-base font-bold text-white">
                    Invite Team Member
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Full Name"
                      className="px-3.5 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@agency.ma"
                      className="px-3.5 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(
                          e.target.value as "property_manager" | "admin"
                        )
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#131A24] border border-slate-700 text-xs text-white"
                    >
                      <option value="property_manager">Property Manager</option>
                      <option value="admin">Organization Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={invitingMember}
                    className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold"
                  >
                    {invitingMember ? "Adding..." : "Add Member to Organization"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* SECTION 6: ORGANIZATION SETTINGS */}
          {activeNav === "settings" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Organization Settings
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Configure organization-level defaults for currency, timezone,
                  and guest interface language.
                </p>
              </div>

              <form
                onSubmit={handleSaveOrgSettings}
                className="rounded-3xl bg-[#0F141C] border border-slate-800 p-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    disabled={!isAdmin}
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default Currency
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      disabled={!isAdmin}
                      value={orgCurrency}
                      onChange={(e) =>
                        setOrgCurrency(e.target.value.toUpperCase())
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm font-mono text-white disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default Timezone
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={orgTimezone}
                      onChange={(e) => setOrgTimezone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm font-mono text-white disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default Guest Language
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={orgLang}
                      onChange={(e) =>
                        setOrgLang(e.target.value as "en" | "fr" | "ar")
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131A24] border border-slate-700 text-sm text-white disabled:opacity-50"
                    >
                      <option value="en">English (EN)</option>
                      <option value="fr">Français (FR)</option>
                      <option value="ar">Arabic (AR — RTL Structure)</option>
                    </select>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="submit"
                    disabled={savingOrg}
                    className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold"
                  >
                    {savingOrg ? "Saving..." : "Save Organization Settings"}
                  </button>
                )}
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Property Workspace Modal */}
      {workspacePropertyId && (
        <PropertyWorkspaceModal
          propertyId={workspacePropertyId}
          categories={data.categories}
          onClose={() => setWorkspacePropertyId(null)}
          onUpdated={refreshDashboard}
        />
      )}

      {/* Create Property Modal */}
      {showCreateProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleCreateProperty}
            className="w-full max-w-lg rounded-3xl bg-[#131A24] border border-slate-700 p-6 space-y-4 text-white shadow-2xl"
          >
            <h3 className="text-lg font-bold">Create New Property</h3>
            {createPropError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                {createPropError}
              </div>
            )}

            <div className="rounded-2xl border border-[#C85A32]/40 bg-[#C85A32]/10 p-3.5 space-y-2.5">
              <label className="block text-xs font-semibold text-white">
                Import from Airbnb link
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={airbnbUrl}
                  onChange={(e) => {
                    setAirbnbUrl(e.target.value);
                    setImportedListing(null);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").trim();
                    if (/airbnb\.|abnb\.me/i.test(pasted)) {
                      e.preventDefault();
                      setAirbnbUrl(pasted);
                      setImportedListing(null);
                      void importFromAirbnb(pasted);
                    }
                  }}
                  placeholder="https://www.airbnb.com/rooms/12345678"
                  className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => void importFromAirbnb()}
                  disabled={importingAirbnb || !airbnbUrl.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#C85A32] text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                >
                  {importingAirbnb ? "Importing..." : "Import"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Paste a listing link: the title, cover photo, gallery,
                description, city, type, features and map are filled in
                automatically. You can still edit everything below.
              </p>
              {importedListing && (
                <div className="flex items-center gap-3 rounded-xl bg-[#0B0F17] border border-slate-700 p-2">
                  {importedListing.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={importedListing.photos[0]}
                      alt="Imported cover"
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 text-[11px] text-slate-300">
                    <div className="font-semibold text-emerald-300">
                      Imported from Airbnb
                    </div>
                    <div>
                      {importedListing.photos.length} photo
                      {importedListing.photos.length === 1 ? "" : "s"} · cover
                      photo set
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Property Name *
              </label>
              <input
                type="text"
                required={!airbnbUrl.trim()}
                value={newPropName}
                onChange={(e) => {
                  setNewPropName(e.target.value);
                  setNewPropSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }}
                placeholder="e.g., Riad Zitoun Kasbah"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Public Slug *
                </label>
                <input
                  type="text"
                  required={!airbnbUrl.trim()}
                  value={newPropSlug}
                  onChange={(e) => setNewPropSlug(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required={!airbnbUrl.trim()}
                  value={newPropCity}
                  onChange={(e) => setNewPropCity(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Property Type
                </label>
                <select
                  value={newPropType}
                  onChange={(e) =>
                    setNewPropType(e.target.value as PropertyType)
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  <option value="riad">Riad</option>
                  <option value="villa">Villa</option>
                  <option value="apartment">Apartment</option>
                  <option value="studio">Studio</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Initial Status
                </label>
                <select
                  value={newPropStatus}
                  onChange={(e) =>
                    setNewPropStatus(e.target.value as PropertyStatus)
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Default Host WhatsApp Number (International) *
              </label>
              <input
                type="text"
                required
                value={newPropWhatsapp}
                onChange={(e) => setNewPropWhatsapp(e.target.value)}
                placeholder="+212612345678"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs font-mono text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateProperty(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProp}
                className="px-5 py-2 rounded-xl bg-[#C85A32] text-white text-xs font-semibold"
              >
                {creatingProp ? "Creating..." : "Create Property"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Custom Catalogue Service Modal (with Duplicate Name Warning) */}
      {showCreateCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#131A24] border border-slate-700 p-6 space-y-4 text-white shadow-2xl">
            <h3 className="text-lg font-bold">
              Create Custom Service for {data.actor.organization.name}
            </h3>

            {customSvcError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                {customSvcError}
              </div>
            )}

            {duplicateWarningList && duplicateWarningList.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Possible Duplicate Service Name Detected</span>
                </div>
                <p>
                  Similar service(s) already exist in your catalogue:{" "}
                  <strong>
                    {duplicateWarningList.map((d) => d.name_en).join(", ")}
                  </strong>
                  . Do you want to reuse the existing service or create this new
                  custom service anyway?
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCreateCustomService(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs"
                  >
                    Create Anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarningList(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs"
                  >
                    Edit Name
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Service Name (EN) *
                </label>
                <input
                  type="text"
                  required
                  value={custNameEn}
                  onChange={(e) => setCustNameEn(e.target.value)}
                  placeholder="e.g., Rooftop Yoga & Mint Tea"
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Service Name (FR)
                </label>
                <input
                  type="text"
                  value={custNameFr}
                  onChange={(e) => setCustNameFr(e.target.value)}
                  placeholder="ex., Yoga sur le Toit & Thé"
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={custCategory}
                  onChange={(e) => setCustCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  {data.categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Pricing Mode
                </label>
                <select
                  value={custPricingMode}
                  onChange={(e) =>
                    setCustPricingMode(e.target.value as PricingMode)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="quote">Quote Required</option>
                </select>
              </div>
              {custPricingMode === "fixed" && (
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Suggested Price (MAD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={custPrice}
                    onChange={(e) => setCustPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Pricing Unit
                </label>
                <select
                  value={custUnit}
                  onChange={(e) => setCustUnit(e.target.value as PricingUnit)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  <option value="per_person">Per Person</option>
                  <option value="per_booking">Per Booking</option>
                  <option value="per_hour">Per Hour</option>
                  <option value="per_night">Per Night</option>
                  <option value="per_item">Per Item</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Also Attach Immediately To (Optional)
                </label>
                <select
                  value={custAttachPropertyId}
                  onChange={(e) => setCustAttachPropertyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
                >
                  <option value="">Catalogue Only (Reuse Later)</option>
                  {data.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Description (EN)
              </label>
              <textarea
                rows={2}
                value={custDescEn}
                onChange={(e) => setCustDescEn(e.target.value)}
                placeholder="Describe what is included in this custom service..."
                className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateCatalogModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingCustomSvc || !custNameEn.trim()}
                onClick={() => handleCreateCustomService(false)}
                className="px-5 py-2 rounded-xl bg-[#C85A32] text-white text-xs font-semibold disabled:opacity-40"
              >
                {creatingCustomSvc
                  ? "Saving..."
                  : "Save to Organization Catalogue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync with Hostaway Modal */}
      {showHostawayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSyncHostaway}
            className="w-full max-w-lg rounded-3xl bg-[#131A24] border border-slate-700 p-6 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#F4A261]">
                  Automatic PMS Integration
                </span>
                <h3 className="text-lg font-bold mt-0.5">
                  Sync Properties from Hostaway
                </h3>
              </div>
              {data.actor.organization.has_hostaway_api_key && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                  API Connected
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Automatically imports all your Hostaway listings—including property
              names, descriptions, high-resolution photos, city, Google Maps GPS
              coordinates, and detected amenities/features—into Supabase.
            </p>

            {hostawayError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                {hostawayError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Hostaway Account ID *
                </label>
                <input
                  type="text"
                  required={!data.actor.organization.hostaway_account_id}
                  value={hostawayAccountId}
                  onChange={(e) => setHostawayAccountId(e.target.value)}
                  placeholder="e.g., 12345 (Settings → Hostaway API)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Hostaway API Key{" "}
                  {data.actor.organization.has_hostaway_api_key
                    ? "(Saved — leave blank to reuse)"
                    : "*"}
                </label>
                <input
                  type="password"
                  required={!data.actor.organization.has_hostaway_api_key}
                  value={hostawayApiKey}
                  onChange={(e) => setHostawayApiKey(e.target.value)}
                  placeholder={
                    data.actor.organization.has_hostaway_api_key
                      ? "••••••••••••••••••••••••"
                      : "Paste your Hostaway Secret API Key"
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Default WhatsApp Number for New Properties (E.164)
                </label>
                <input
                  type="text"
                  value={hostawayDefaultWhatsapp}
                  onChange={(e) => setHostawayDefaultWhatsapp(e.target.value)}
                  placeholder="+212600112233"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-xs text-white font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Used if a Hostaway listing doesn’t have a valid E.164 phone
                  number. Existing synced properties keep their configured
                  WhatsApp numbers.
                </p>
              </div>
            </div>

            {data.actor.organization.hostaway_last_synced_at && (
              <p className="text-[11px] text-slate-400">
                Last synced:{" "}
                <span className="text-slate-200 font-semibold">
                  {new Date(
                    data.actor.organization.hostaway_last_synced_at
                  ).toLocaleString()}
                </span>
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHostawayModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={syncingHostaway}
                className="px-5 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A64522] text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {syncingHostaway ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing Listings...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Properties from Hostaway</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
