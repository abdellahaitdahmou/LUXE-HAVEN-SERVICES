import { PricingUnit, PropertyType, RequestStatus, SupportedLocale } from "./types";

export interface LocaleConfig {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
  enabled: boolean;
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleConfig> = {
  en: {
    code: "en",
    label: "English",
    nativeLabel: "EN",
    dir: "ltr",
    enabled: true,
  },
  fr: {
    code: "fr",
    label: "French",
    nativeLabel: "FR",
    dir: "ltr",
    enabled: true,
  },
  ar: {
    code: "ar",
    label: "Arabic (RTL Ready)",
    nativeLabel: "عربي",
    dir: "rtl",
    enabled: false, // Structured for Arabic & RTL expansion
  },
};

export const TRANSLATIONS = {
  en: {
    brandTagline: "Curated Guest Services in Morocco",
    welcomeBadge: "Digital Guest Concierge",
    allCategories: "All Services",
    searchServices: "Search services (e.g., breakfast, airport, hammam)...",
    requestQuote: "Request a quote",
    fixedPrice: "Fixed price",
    configureRequest: "Request via WhatsApp",
    viewConditions: "Conditions & Schedule",
    advanceNoticeLabel: "Min. advance notice",
    hoursUnit: "h",
    availableDays: "Available days",
    availableHours: "Requestable window",
    blackoutDatesLabel: "Unavailable dates",
    guestNameLabel: "Your Full Name",
    guestNamePlaceholder: "e.g., Sarah",
    requestedDateLabel: "Requested Date",
    requestedTimeLabel: "Preferred Time",
    quantityLabel: "Quantity",
    optionalNoteLabel: "Special Requests / Dietary or Flight Notes (Optional)",
    optionalNotePlaceholder: "e.g., One vegetarian breakfast, or Flight AT402 arriving at 14:30",
    estimatedTotalLabel: "Estimated Total",
    quoteEstimatedTotal: "To be quoted by host",
    reviewSummaryBtn: "Review Request Summary",
    editRequestBtn: "Modify Details",
    openWhatsAppBtn: "Open WhatsApp to Send Request",
    demoContactProtectedTitle: "Demo Contact Protection Active",
    demoContactProtectedBody:
      "This demo property uses a placeholder Moroccan phone number. Your request has been saved to the database and the exact WhatsApp message & wa.me link are generated below for inspection, with external redirect disabled to prevent messaging unconfigured numbers.",
    confirmationDisclaimer:
      "Your request is subject to host confirmation. Tap Send in WhatsApp to send your message.",
    preparedNotice:
      "Opening WhatsApp prepares your pre-filled message. Your booking is only confirmed once the host replies.",
    requestReferenceLabel: "Request Reference",
    noServicesInCategory: "No active services found in this category.",
    timezoneFootnote: "All times are local to the property timezone",
    mapLinkLabel: "View Location on Map",
    featuresHeading: "Property Highlights",
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    weekdaysFull: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
  },
  fr: {
    brandTagline: "Conciergerie & Services Invités au Maroc",
    welcomeBadge: "Conciergerie Digitale",
    allCategories: "Tous les Services",
    searchServices: "Rechercher un service (ex. petit-déjeuner, transfert, hammam)...",
    requestQuote: "Sur devis",
    fixedPrice: "Prix fixe",
    configureRequest: "Demander sur WhatsApp",
    viewConditions: "Conditions & Horaires",
    advanceNoticeLabel: "Préavis minimum",
    hoursUnit: "h",
    availableDays: "Jours disponibles",
    availableHours: "Créneau horaire",
    blackoutDatesLabel: "Dates indisponibles",
    guestNameLabel: "Votre Prénom / Nom",
    guestNamePlaceholder: "ex. Sarah",
    requestedDateLabel: "Date souhaitée",
    requestedTimeLabel: "Heure souhaitée",
    quantityLabel: "Quantité",
    optionalNoteLabel: "Note ou précision (Optionnel)",
    optionalNotePlaceholder: "ex. Un petit-déjeuner végétarien, ou Vol AT402 arrivée 14h30",
    estimatedTotalLabel: "Total estimé",
    quoteEstimatedTotal: "Tarif confirmé sur devis par l'hôte",
    reviewSummaryBtn: "Vérifier le récapitulatif",
    editRequestBtn: "Modifier les détails",
    openWhatsAppBtn: "Ouvrir WhatsApp pour envoyer",
    demoContactProtectedTitle: "Protection Contact Démo Active",
    demoContactProtectedBody:
      "Ce logement de démonstration utilise un numéro fictif. Votre demande est enregistrée en base et le lien wa.me exact est affiché ci-dessous, sans ouverture externe vers un numéro non configuré.",
    confirmationDisclaimer:
      "Votre demande est soumise à la confirmation de l'hôte. Appuyez sur Envoyer dans WhatsApp pour transmettre votre message.",
    preparedNotice:
      "L'ouverture de WhatsApp pré-remplit votre message. La prestation n'est confirmée qu'après réponse de l'hôte.",
    requestReferenceLabel: "Référence de demande",
    noServicesInCategory: "Aucun service actif dans cette catégorie.",
    timezoneFootnote: "Toutes les heures sont au fuseau horaire local du logement",
    mapLinkLabel: "Voir l'emplacement sur la carte",
    featuresHeading: "Atouts du logement",
    weekdaysShort: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    weekdaysFull: [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ],
  },
  ar: {
    brandTagline: "خدمات الضيافة المختارة في المغرب",
    welcomeBadge: "كونسيرج الضيوف الرقمي",
    allCategories: "جميع الخدمات",
    searchServices: "ابحث عن خدمة...",
    requestQuote: "اطلب عرض سعر",
    fixedPrice: "سعر ثابت",
    configureRequest: "اطلب عبر واتساب",
    viewConditions: "الشروط والمواعيد",
    advanceNoticeLabel: "إشعار مسبق",
    hoursUnit: "ساعة",
    availableDays: "الأيام المتاحة",
    availableHours: "أوقات الطلب",
    blackoutDatesLabel: "تواريخ غير متاحة",
    guestNameLabel: "الاسم الكامل",
    guestNamePlaceholder: "مثال: سارة",
    requestedDateLabel: "التاريخ المطلوب",
    requestedTimeLabel: "الوقت المفضل",
    quantityLabel: "الكمية",
    optionalNoteLabel: "ملاحظات إضافية (اختياري)",
    optionalNotePlaceholder: "مثال: فطور نباتي واحد",
    estimatedTotalLabel: "المجموع التقديري",
    quoteEstimatedTotal: "يتم تحديد السعر من طرف المضيف",
    reviewSummaryBtn: "مراجعة ملخص الطلب",
    editRequestBtn: "تعديل التفاصيل",
    openWhatsAppBtn: "افتح واتساب لإرسال الطلب",
    demoContactProtectedTitle: "حماية أرقام التجربة مفعلة",
    demoContactProtectedBody: "تم حفظ الطلب وتوليد رسالة واتساب لمعاينتها بأمان.",
    confirmationDisclaimer:
      "طلبك خاضع لتأكيد المضيف. اضغط على إرسال في واتساب لإرسال رسالتك.",
    preparedNotice: "فتح واتساب يجهز رسالتك ولا يعني تأكيد الحجز تلقائياً.",
    requestReferenceLabel: "مرجع الطلب",
    noServicesInCategory: "لا توجد خدمات نشطة في هذه الفئة.",
    timezoneFootnote: "جميع الأوقات حسب التوقيت المحلي للعقار",
    mapLinkLabel: "عرض الموقع على الخريطة",
    featuresHeading: "مميزات العقار",
    weekdaysShort: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
    weekdaysFull: [
      "الأحد",
      "الإثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ],
  },
};

export function formatPricingUnitLabel(
  unit: PricingUnit,
  locale: SupportedLocale = "en",
  quantity?: number
): string {
  const isPlural = quantity !== undefined && quantity > 1;
  const map: Record<PricingUnit, Record<SupportedLocale, [string, string]>> = {
    per_booking: {
      en: ["booking", "bookings"],
      fr: ["réservation", "réservations"],
      ar: ["حجز", "حجوزات"],
    },
    per_person: {
      en: ["person", "people"],
      fr: ["personne", "personnes"],
      ar: ["شخص", "أشخاص"],
    },
    per_hour: {
      en: ["hour", "hours"],
      fr: ["heure", "heures"],
      ar: ["ساعة", "ساعات"],
    },
    per_night: {
      en: ["night", "nights"],
      fr: ["nuit", "nuits"],
      ar: ["ليلة", "ليالٍ"],
    },
    per_item: {
      en: ["item", "items"],
      fr: ["article", "articles"],
      ar: ["قطعة", "قطع"],
    },
  };

  const entry = map[unit]?.[locale] ?? map.per_booking.en;
  return isPlural ? entry[1] : entry[0];
}

export function formatPricingUnitBadge(
  unit: PricingUnit,
  locale: SupportedLocale = "en"
): string {
  const labels: Record<PricingUnit, Record<SupportedLocale, string>> = {
    per_booking: {
      en: "per booking",
      fr: "par réservation",
      ar: "لكل حجز",
    },
    per_person: {
      en: "per person",
      fr: "par personne",
      ar: "لكل شخص",
    },
    per_hour: {
      en: "per hour",
      fr: "par heure",
      ar: "لكل ساعة",
    },
    per_night: {
      en: "per night",
      fr: "par nuit",
      ar: "لكل ليلة",
    },
    per_item: {
      en: "per item",
      fr: "par unité",
      ar: "لكل قطعة",
    },
  };
  return labels[unit]?.[locale] ?? labels.per_booking.en;
}

export function formatFeatureLabel(
  feature: string,
  locale: SupportedLocale = "en"
): string {
  const dictionary: Record<string, Record<SupportedLocale, string>> = {
    pool: { en: "Swimming Pool", fr: "Piscine privée", ar: "مسبح" },
    hammam: { en: "Traditional Hammam", fr: "Hammam beldi", ar: "حمام تقليدي" },
    garden: { en: "Lush Garden", fr: "Jardin arboré", ar: "حديقة" },
    kitchen: { en: "Full Kitchen", fr: "Cuisine équipée", ar: "مطبخ مجهز" },
    beach_proximity: {
      en: "Near the Beach",
      fr: "Proximité plage",
      ar: "قريب من الشاطئ",
    },
    terrace: { en: "Sun Terrace", fr: "Terrasse plein sud", ar: "شرفة مشمسة" },
    wifi: { en: "High-Speed Wi-Fi", fr: "Wi-Fi Fibre", ar: "واي فاي سريع" },
    air_conditioning: {
      en: "Air Conditioning",
      fr: "Climatisation",
      ar: "تكييف",
    },
    parking: { en: "Private Parking", fr: "Parking privé", ar: "موقف سيارات" },
    surf_rack: {
      en: "Surfboard Storage",
      fr: "Rangement planches de surf",
      ar: "مخزن ألواح ركوب الأمواج",
    },
  };
  return (
    dictionary[feature]?.[locale] ??
    feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatPropertyTypeLabel(
  type: PropertyType,
  locale: SupportedLocale = "en"
): string {
  const labels: Record<PropertyType, Record<SupportedLocale, string>> = {
    apartment: { en: "Apartment", fr: "Appartement", ar: "شقة" },
    villa: { en: "Villa", fr: "Villa", ar: "فيلا" },
    riad: { en: "Riad", fr: "Riad", ar: "رياض" },
    studio: { en: "Studio", fr: "Studio", ar: "استوديو" },
    other: { en: "Other", fr: "Autre", ar: "آخر" },
  };
  return labels[type]?.[locale] ?? type;
}

export function formatRequestStatusInfo(status: RequestStatus): {
  label: string;
  description: string;
  badgeClass: string;
} {
  switch (status) {
    case "prepared":
      return {
        label: "Prepared",
        description:
          "Saved before WhatsApp handoff. Does NOT prove the guest pressed Send in WhatsApp.",
        badgeClass:
          "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    case "confirmed":
      return {
        label: "Confirmed",
        description:
          "Host or provider verified availability & confirmed with guest via WhatsApp.",
        badgeClass:
          "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      };
    case "completed":
      return {
        label: "Completed",
        description: "Service was delivered to the guest.",
        badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      };
    case "declined":
      return {
        label: "Declined",
        description: "Provider or host could not fulfill the requested slot.",
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        description: "Cancelled by guest or property manager.",
        badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      };
  }
}
