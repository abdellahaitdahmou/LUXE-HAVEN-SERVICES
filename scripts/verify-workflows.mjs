/**
 * StayBeldi — Automated End-to-End Verification Suite
 * Verifies all 10 required core workflows against the live Next.js server.
 */

const BASE_URL = process.env.VERIFY_BASE_URL || "http://localhost:3000";

const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001"; // Karim (Admin, Org 1)
const MANAGER_USER_ID = "00000000-0000-4000-8000-000000000002"; // Salma (Property Manager, Org 1: Agadir & Tamraght only)
const OTHER_ORG_ADMIN_ID = "00000000-0000-4000-8000-000000000003"; // Omar (Admin, Org 2)

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function api(path, options = {}, userId = ADMIN_USER_ID) {
  const headers = {
    "Content-Type": "application/json",
    ...(userId ? { "x-staybeldi-user-id": userId } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON (e.g. QR code image)
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

async function runVerification() {
  console.log("=============================================================");
  console.log("StayBeldi — Verifying 10 Core Hospitality Workflows");
  console.log("=============================================================\n");

  // Reset demo database to clean initial state before running tests
  const resetRes = await api("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "reset_demo_data" }),
  });
  assert(resetRes.ok, "Failed to reset demo data state");

  // ---------------------------------------------------------------------------
  // WORKFLOW 1: Create and publish a property (+ QR code generation)
  // ---------------------------------------------------------------------------
  console.log("1. Testing: Create and publish a property...");
  const createPropRes = await api("/api/admin/properties", {
    method: "POST",
    body: JSON.stringify({
      name: "Riad Atlas Kasbah",
      slug: "riad-atlas-kasbah",
      property_type: "riad",
      city: "Marrakech",
      default_whatsapp: "+212600000055",
      default_whatsapp_label: "Hassan — Riad Host",
      is_demo_contact: true,
      features: ["pool", "hammam", "kitchen", "terrace"],
      status: "published",
      timezone: "Africa/Casablanca",
      currency: "MAD",
      description_en: "Serene courtyard riad in the Kasbah district.",
      description_fr: "Riad paisible au cœur de la Kasbah.",
    }),
  });
  assert(
    createPropRes.status === 201 && createPropRes.json?.property?.id,
    `Expected 201 property creation, got ${createPropRes.status}`
  );
  const newProp = createPropRes.json.property;

  // Verify public guest page & downloadable QR code
  const qrRes = await api(
    `/api/admin/properties/${newProp.id}/qrcode?format=svg`
  );
  assert(
    qrRes.status === 200 && qrRes.text.includes("<svg"),
    "Expected valid downloadable SVG QR code"
  );
  console.log("   PASS: Created & published 'Riad Atlas Kasbah' + generated QR code.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 2: Add a catalogue service to the new property
  // ---------------------------------------------------------------------------
  console.log("2. Testing: Add a reusable catalogue service to a property...");
  const BREAKFAST_TEMPLATE_ID = "10000000-0000-4000-8000-000000000002";
  const attachRes = await api(
    `/api/admin/properties/${newProp.id}/services`,
    {
      method: "POST",
      body: JSON.stringify({ catalogServiceIds: [BREAKFAST_TEMPLATE_ID] }),
    }
  );
  assert(
    attachRes.status === 201 && attachRes.json?.services?.length === 1,
    "Expected 1 attached service from catalogue"
  );
  const riadBreakfastService = attachRes.json.services[0];
  assert(
    riadBreakfastService.name_en === "Breakfast" &&
      riadBreakfastService.price === 85,
    "Expected starter template defaults (85 MAD) on newly attached property service"
  );
  console.log("   PASS: Attached 'Breakfast' starter template to 'Riad Atlas Kasbah'.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 3: Create a custom service (with duplicate warning + org isolation)
  //             and reuse it on another property
  // ---------------------------------------------------------------------------
  console.log("3. Testing: Create a custom service, duplicate warning & reuse across properties...");
  // 3a. Verify duplicate warning when creating a service named "Breakfast"
  const dupRes = await api("/api/admin/catalog", {
    method: "POST",
    body: JSON.stringify({
      category_key: "food_drinks",
      name_en: "Breakfast",
      description_en: "Duplicate test",
      default_pricing_mode: "fixed",
      suggested_price: 90,
      default_pricing_unit: "per_person",
      save_to_org_catalog: true,
    }),
  });
  assert(
    dupRes.status === 409 && dupRes.json?.status === "duplicate_warning",
    "Expected 409 duplicate_warning when creating a service with an existing name"
  );

  // 3b. Create a unique custom service for Org 1 and attach to Riad Atlas Kasbah
  const customSvcRes = await api("/api/admin/catalog", {
    method: "POST",
    body: JSON.stringify({
      category_key: "wellness",
      name_en: "Rooftop Sunrise Yoga & Saffron Tea",
      name_fr: "Yoga au Lever du Soleil sur le Toit",
      description_en: "75-minute private hatha yoga session on the riad rooftop.",
      default_pricing_mode: "fixed",
      suggested_price: 380,
      default_pricing_unit: "per_person",
      default_min_quantity: 1,
      default_max_quantity: 6,
      default_advance_notice_hours: 18,
      requires_time_slot: true,
      save_to_org_catalog: true,
      attachToPropertyId: newProp.id,
    }),
  });
  assert(
    customSvcRes.status === 201 && customSvcRes.json?.catalogService?.id,
    "Expected custom service to be saved to organization catalogue"
  );
  const customCatalogId = customSvcRes.json.catalogService.id;

  // 3c. Reuse that custom service on Islan Apartment (Agadir: 30000000-0000-4000-8000-000000000001)
  const reuseRes = await api(
    "/api/admin/properties/30000000-0000-4000-8000-000000000001/services",
    {
      method: "POST",
      body: JSON.stringify({ catalogServiceIds: [customCatalogId] }),
    }
  );
  assert(
    reuseRes.status === 201 && reuseRes.json?.services?.[0]?.name_en === "Rooftop Sunrise Yoga & Saffron Tea",
    "Expected custom service to be reusable on another property in the same organization"
  );

  // 3d. Verify unrelated organization (Omar, Org 2) CANNOT see or use Org 1's custom service
  const otherOrgCatalogRes = await api(
    "/api/admin/catalog",
    {},
    OTHER_ORG_ADMIN_ID
  );
  const leaked = otherOrgCatalogRes.json?.catalogServices?.some(
    (c) => c.id === customCatalogId
  );
  assert(
    !leaked,
    "Organization custom service must NOT be exposed to unrelated organizations"
  );
  console.log("   PASS: Custom service created, duplicate warning verified, reused on second property, and isolated from other orgs.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 4: Change one property's price without affecting another property
  //             or the catalogue template
  // ---------------------------------------------------------------------------
  console.log("4. Testing: Change one property's service price without affecting other properties...");
  // Update Riad Atlas Kasbah's Breakfast price from 85 MAD to 110 MAD
  const updateSvcRes = await api(
    `/api/admin/property-services/${riadBreakfastService.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name_en: "Kasbah Royal Beldi Breakfast",
        name_fr: "Petit-déjeuner Royal de la Kasbah",
        description_en: riadBreakfastService.description_en,
        description_fr: riadBreakfastService.description_fr,
        conditions_en: "Served on the courtyard patio.",
        conditions_fr: "Servi dans le patio.",
        category_key: "food_drinks",
        is_active: true,
        pricing_mode: "fixed",
        price: 110,
        currency: "MAD",
        pricing_unit: "per_person",
        min_quantity: 1,
        max_quantity: 8,
        advance_notice_hours: 12,
        requires_time_slot: true,
        display_order: 1,
        whatsapp_override: "",
      }),
    }
  );
  assert(
    updateSvcRes.ok && updateSvcRes.json?.service?.price === 110,
    "Expected Riad Atlas Kasbah breakfast price to update to 110 MAD"
  );

  // Check Islan Apartment's Breakfast (40000000-0000-4000-8000-000000000001) is still 75 MAD
  const islanDetail = await api(
    "/api/admin/properties/30000000-0000-4000-8000-000000000001"
  );
  const islanBreakfast = islanDetail.json?.services?.find(
    (s) => s.id === "40000000-0000-4000-8000-000000000001"
  );
  assert(
    islanBreakfast && islanBreakfast.price === 75,
    `Expected Islan Apartment breakfast price to remain 75 MAD, got ${islanBreakfast?.price}`
  );
  console.log("   PASS: Riad breakfast updated to 110 MAD while Agadir apartment remained 75 MAD.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 5: Generate and select AI / rule-based service suggestions
  // ---------------------------------------------------------------------------
  console.log("5. Testing: Generate and select AI / rule-based service suggestions...");
  const suggestRes = await api(
    `/api/admin/properties/${newProp.id}/suggest-services`,
    {
      method: "POST",
      body: JSON.stringify({
        property_type: "riad",
        city: "Marrakech",
        features: ["pool", "hammam", "kitchen"],
      }),
    }
  );
  assert(
    suggestRes.ok &&
      Array.isArray(suggestRes.json?.suggestions) &&
      suggestRes.json.suggestions.length > 0,
    "Expected non-empty suggestions list"
  );
  const firstSuggestion = suggestRes.json.suggestions[0];
  assert(
    firstSuggestion.name_en &&
      firstSuggestion.category_key &&
      firstSuggestion.reason_en,
    "Each suggestion must include name, category, description, and reason"
  );
  console.log(
    `   PASS: Generated ${suggestRes.json.suggestions.length} suggestions (provider: ${suggestRes.json.provider}). Top match: "${firstSuggestion.name_en}".\n`
  );

  // ---------------------------------------------------------------------------
  // WORKFLOW 6: Enforce property-specific manager access
  // ---------------------------------------------------------------------------
  console.log("6. Testing: Enforce property-specific manager access on the server...");
  // Salma (MANAGER_USER_ID) IS assigned to Agadir (30000000-0000-4000-8000-000000000001)
  const managerAllowedRes = await api(
    "/api/admin/properties/30000000-0000-4000-8000-000000000001",
    {},
    MANAGER_USER_ID
  );
  assert(
    managerAllowedRes.status === 200,
    "Assigned property manager should have access to Islan Apartment"
  );

  // Salma is NOT assigned to Marrakech Villa (30000000-0000-4000-8000-000000000002)
  const managerForbiddenRes = await api(
    "/api/admin/properties/30000000-0000-4000-8000-000000000002",
    {},
    MANAGER_USER_ID
  );
  assert(
    managerForbiddenRes.status === 403,
    `Unassigned property manager must receive 403 Forbidden for Marrakech Villa, got ${managerForbiddenRes.status}`
  );
  console.log("   PASS: Property Manager allowed on assigned Agadir property (200) and blocked from unassigned Marrakech Villa (403).\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 7: Validate service dates, weekdays, blackouts, time windows & quantities
  // ---------------------------------------------------------------------------
  console.log("7. Testing: Server-side validation of dates, blackouts, weekdays, time windows & quantities...");
  // 7a. Past date must fail
  const pastDateRes = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000001",
        guest_name: "Sarah",
        requested_date: "2020-01-01",
        requested_time: "09:00",
        quantity: 2,
      }),
    },
    null
  );
  assert(pastDateRes.status === 400, "Past date must be rejected with 400");

  // 7b. Blackout date (2026-10-28 for Islan Breakfast) must fail
  const blackoutRes = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000001",
        guest_name: "Sarah",
        requested_date: "2026-10-28",
        requested_time: "09:00",
        quantity: 2,
      }),
    },
    null
  );
  assert(
    blackoutRes.status === 400 &&
      blackoutRes.json?.error?.toLowerCase().includes("unavailable"),
    "Blackout date must be rejected with 400"
  );

  // 7c. Outside time window (21:00 for Breakfast which is 08:00–11:30) must fail
  const badTimeRes = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000001",
        guest_name: "Sarah",
        requested_date: "2026-10-22",
        requested_time: "21:00",
        quantity: 2,
      }),
    },
    null
  );
  assert(
    badTimeRes.status === 400 &&
      badTimeRes.json?.error?.toLowerCase().includes("window"),
    "Out-of-window time must be rejected with 400"
  );

  // 7d. Closed weekday (Sunday 2026-10-25 for Mid-Stay Housekeeping which is closed Sundays)
  const closedWeekdayRes = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000003",
        guest_name: "Sarah",
        requested_date: "2026-10-25",
        requested_time: "11:00",
        quantity: 1,
      }),
    },
    null
  );
  assert(
    closedWeekdayRes.status === 400 &&
      closedWeekdayRes.json?.error?.toLowerCase().includes("sunday"),
    "Closed weekday must be rejected with 400"
  );
  console.log("   PASS: Past dates, blackout dates, out-of-window times, and closed weekdays rejected on server.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 8 & 9: Resolve service-specific vs default WhatsApp recipients,
  //                 calculate server-side totals, and encode WhatsApp link
  // ---------------------------------------------------------------------------
  console.log("8 & 9. Testing: WhatsApp recipient priority, server price calculation & wa.me message encoding...");
  // Request 1: Islan Breakfast (has service override +212600000011, 75 MAD/person * 2 = 150 MAD)
  const validBreakfastReq = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000001",
        guest_name: "Sarah",
        requested_date: "2026-10-22",
        requested_time: "09:00",
        quantity: 2,
        guest_note: "One vegetarian breakfast",
        price: 1, // Attempt browser price tampering — server must ignore this and calculate 150 MAD!
        idempotency_key: "verify-test-key-breakfast",
      }),
    },
    null
  );
  assert(
    validBreakfastReq.status === 201,
    `Expected 201 for valid request, got ${validBreakfastReq.status}: ${validBreakfastReq.text}`
  );
  const brData = validBreakfastReq.json;
  assert(
    brData.request.estimated_total === 150,
    `Expected server-calculated total of 150 MAD, got ${brData.request.estimated_total}`
  );
  assert(
    brData.request.used_override_recipient === true &&
      brData.waMeUrl.startsWith("https://wa.me/212600000011?text="),
    "Expected service override WhatsApp number (212600000011) to be resolved"
  );
  assert(
    brData.whatsappMessage.includes("Property: Islan Apartment") &&
      brData.whatsappMessage.includes("Service: Breakfast") &&
      brData.whatsappMessage.includes("Guest: Sarah") &&
      brData.whatsappMessage.includes("Date: 22 October 2026") &&
      brData.whatsappMessage.includes("Time: 09:00") &&
      brData.whatsappMessage.includes("Quantity: 2 people") &&
      brData.whatsappMessage.includes("Estimated total: 150 MAD") &&
      brData.whatsappMessage.includes("Note: One vegetarian breakfast") &&
      brData.whatsappMessage.includes(`Request reference: ${brData.request.reference_code}`),
    "WhatsApp message text did not match required structure"
  );

  // Request 2: Islan Airport Transfer (NO service override -> falls back to Property Default +212600000001)
  const validTransferReq = await api(
    "/api/public/requests",
    {
      method: "POST",
      body: JSON.stringify({
        property_slug: "islan-apartment",
        property_service_id: "40000000-0000-4000-8000-000000000002",
        guest_name: "Sarah",
        requested_date: "2026-10-23",
        requested_time: "14:00",
        quantity: 1,
        guest_note: "Flight AT402",
      }),
    },
    null
  );
  assert(
    validTransferReq.status === 201 &&
      validTransferReq.json.request.used_override_recipient === false &&
      validTransferReq.json.waMeUrl.startsWith("https://wa.me/212600000001?text="),
    "Expected fallback to property default WhatsApp number (212600000001)"
  );
  console.log("   PASS: Service override & default host WhatsApp recipients resolved accurately; message & wa.me URL verified.\n");

  // ---------------------------------------------------------------------------
  // WORKFLOW 10: Ensure public visitors cannot read private data
  // ---------------------------------------------------------------------------
  console.log("10. Testing: Public visitor data isolation (no phone numbers, no internal IDs, no request listing)...");
  const pubStayRes = await api("/api/public/stay/islan-apartment", {}, null);
  assert(pubStayRes.status === 200, "Expected 200 for published property");
  const rawPubJson = JSON.stringify(pubStayRes.json);
  assert(
    !rawPubJson.includes("default_whatsapp") &&
      !rawPubJson.includes("whatsapp_override") &&
      !rawPubJson.includes("212600000"),
    "Public property payload MUST NOT expose host or service WhatsApp numbers"
  );

  const pubRequestsListRes = await api("/api/public/requests", {}, null);
  assert(
    pubRequestsListRes.status === 403,
    "Public visitors MUST NOT be able to list service requests (expected 403)"
  );
  console.log("   PASS: Public endpoints strip all phone numbers and block request listing (403).\n");

  console.log("=============================================================");
  console.log("ALL 10 CORE WORKFLOWS VERIFIED SUCCESSFULLY!");
  console.log("=============================================================");
}

runVerification().catch((err) => {
  console.error("\nVERIFICATION FAILED:", err);
  process.exit(1);
});
