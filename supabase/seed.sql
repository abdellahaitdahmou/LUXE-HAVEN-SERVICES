-- =============================================================================
-- StayBeldi - Seed Data (Global Starter Catalogue + Moroccan Demo Properties)
-- =============================================================================

-- 1. Service Categories
INSERT INTO public.service_categories (key, name_en, name_fr, name_ar, icon_name, display_order)
VALUES
    ('transport', 'Transport', 'Transport', 'النقل', 'Car', 1),
    ('food_drinks', 'Food & Drinks', 'Restauration & Boissons', 'الطعام والمشروبات', 'UtensilsCrossed', 2),
    ('cleaning', 'Cleaning & Linen', 'Ménage & Linge', 'التنظيف والبياضات', 'Sparkles', 3),
    ('wellness', 'Wellness & Spa', 'Bien-être & Spa', 'العافية والسبا', 'HeartHandshake', 4),
    ('activities', 'Activities & Excursions', 'Activités & Excursions', 'الأنشطة والرحلات', 'Compass', 5),
    ('property_extras', 'Property Extras', 'Extras Propriété', 'إضافات العقار', 'KeyRound', 6)
ON CONFLICT (key) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_fr = EXCLUDED.name_fr,
    name_ar = EXCLUDED.name_ar,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order;

-- 2. Global Starter Service Templates (12 reusable templates)
INSERT INTO public.service_catalog (
    id, organization_id, is_global_template, category_key,
    name_en, name_fr, description_en, description_fr,
    default_image_url, default_pricing_mode, suggested_price, default_currency,
    default_pricing_unit, default_min_quantity, default_max_quantity,
    default_advance_notice_hours, requires_time_slot,
    recommended_property_types, recommended_features
)
VALUES
    (
        '10000000-0000-4000-8000-000000000001', NULL, true, 'transport',
        'Airport Transfer', 'Transfert Aéroport',
        'Private air-conditioned transfer between the airport and your property with flight tracking and meet-and-greet.',
        'Transfert privé climatisé entre l''aéroport et votre logement avec suivi de vol et accueil personnalisé.',
        'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80',
        'fixed', 250.00, 'MAD', 'per_booking', 1, 2, 24, true,
        '{apartment,villa,riad,studio,other}', '{}'
    ),
    (
        '10000000-0000-4000-8000-000000000002', NULL, true, 'food_drinks',
        'Traditional Beldi Breakfast', 'Petit-déjeuner Beldi Traditionnel',
        'Freshly prepared Moroccan breakfast with msemen, baghrir, amlou, local honey, seasonal fruit, eggs, mint tea, and fresh orange juice.',
        'Petit-déjeuner marocain préparé chaque matin : msemen, baghrir, amlou, miel local, fruits de saison, œufs, thé à la menthe et jus d''orange pressé.',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80',
        'fixed', 85.00, 'MAD', 'per_person', 1, 12, 14, true,
        '{apartment,villa,riad,studio,other}', '{kitchen}'
    ),
    (
        '10000000-0000-4000-8000-000000000003', NULL, true, 'food_drinks',
        'Private In-House Chef', 'Chef Privé à Domicile',
        'A dedicated Moroccan dada or private chef prepares an authentic multi-course tagine, couscous, or seafood dinner in your property kitchen.',
        'Une cheffe marocaine (Dada) prépare un dîner authentique sur mesure (tajine, couscous royal ou poissons grillés) directement sur place.',
        'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=900&q=80',
        'quote', NULL, 'MAD', 'per_person', 2, 14, 24, true,
        '{villa,riad,apartment}', '{kitchen}'
    ),
    (
        '10000000-0000-4000-8000-000000000004', NULL, true, 'cleaning',
        'Mid-Stay Extra Cleaning', 'Ménage Supplémentaire en Cours de Séjour',
        'Full refresh of living areas, bedrooms, kitchen, and bathrooms during your stay by our trusted housekeeping team.',
        'Remise au propre complète des espaces de vie, chambres, cuisine et salles de bain pendant votre séjour.',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
        'fixed', 200.00, 'MAD', 'per_booking', 1, 1, 18, true,
        '{apartment,villa,riad,studio,other}', '{}'
    ),
    (
        '10000000-0000-4000-8000-000000000005', NULL, true, 'cleaning',
        'Fresh Linen & Towel Change', 'Changement de Draps & Serviettes',
        'Freshly laundered cotton bed sheets, bath sheets, and pool towels delivered and changed per bedroom set.',
        'Ensemble de draps en coton frais, serviettes de bain et serviettes de piscine remplacés par chambre.',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80',
        'fixed', 90.00, 'MAD', 'per_item', 1, 8, 12, true,
        '{apartment,villa,riad,studio,other}', '{}'
    ),
    (
        '10000000-0000-4000-8000-000000000006', NULL, true, 'property_extras',
        'Late Checkout', 'Départ Tardif (Late Checkout)',
        'Extend your checkout until 16:00 so you can enjoy a relaxed final afternoon before your departure flight.',
        'Prolongez votre départ jusqu''à 16h00 pour profiter pleinement de votre dernier après-midi en toute sérénité.',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
        'fixed', 300.00, 'MAD', 'per_booking', 1, 1, 24, false,
        '{apartment,villa,riad,studio,other}', '{}'
    ),
    (
        '10000000-0000-4000-8000-000000000007', NULL, true, 'property_extras',
        'Early Check-in', 'Arrivée Anticipée (Early Check-in)',
        'Priority preparation of your property for arrival from 10:00 AM, subject to incoming turnover schedule.',
        'Préparation prioritaire de votre logement pour une arrivée dès 10h00 du matin, sous réserve de disponibilité.',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
        'fixed', 250.00, 'MAD', 'per_booking', 1, 1, 24, true,
        '{apartment,villa,riad,studio,other}', '{}'
    ),
    (
        '10000000-0000-4000-8000-000000000008', NULL, true, 'wellness',
        'Argan Oil Relaxing Massage', 'Massage Relaxant à l''Huile d''Argan',
        '60-minute certified therapist massage using pure warm Moroccan argan oil and orange blossom essence at the property.',
        'Massage bien-être de 60 minutes par une praticienne certifiée à l''huile d''argan pure bio et fleur d''oranger.',
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80',
        'fixed', 450.00, 'MAD', 'per_person', 1, 4, 24, true,
        '{villa,riad,apartment}', '{hammam,garden,pool}'
    ),
    (
        '10000000-0000-4000-8000-000000000009', NULL, true, 'wellness',
        'Traditional Hammam Session', 'Séance de Hammam Traditionnel Beldi',
        'Private traditional steam ritual with eucalyptus black soap (savon beldi), kessa exfoliation, and ghassoul clay mask.',
        'Rituel hammam privé avec savon noir à l''eucalyptus, gommage au gant kessa et enveloppement au rhassoul.',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
        'fixed', 500.00, 'MAD', 'per_person', 1, 4, 24, true,
        '{villa,riad}', '{hammam}'
    ),
    (
        '10000000-0000-4000-8000-000000000010', NULL, true, 'property_extras',
        'Private Pool Heating', 'Chauffage de la Piscine Privée',
        'Maintain the private swimming pool at a comfortable 28°C–30°C throughout your stay (requires 48h pre-heating notice).',
        'Maintien de la piscine privée entre 28°C et 30°C (nécessite 48h de préchauffage avant utilisation).',
        'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=900&q=80',
        'fixed', 350.00, 'MAD', 'per_night', 2, 14, 48, false,
        '{villa,riad}', '{pool}'
    ),
    (
        '10000000-0000-4000-8000-000000000011', NULL, true, 'activities',
        'Atlantic Surf Lesson & Board Coaching', 'Cours de Surf & Planche + Combinaison',
        '2-hour surf session with a local ISA-certified instructor, wetsuit, surfboard, and beach spot transport.',
        'Session de surf de 2 heures avec moniteur diplômé, planche adaptée, combinaison et transfert vers le spot.',
        'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80',
        'fixed', 320.00, 'MAD', 'per_person', 1, 6, 16, true,
        '{apartment,studio,villa}', '{beach_proximity}'
    ),
    (
        '10000000-0000-4000-8000-000000000012', NULL, true, 'activities',
        'Private Day Excursion', 'Excursion Privée à la Journée',
        'Tailored full-day excursion with a private driver-guide (Paradise Valley, Atlas Mountains, or Essaouira coast).',
        'Excursion privée sur mesure avec chauffeur-guide (Vallée du Paradis, Haut Atlas ou côte d''Essaouira).',
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=900&q=80',
        'quote', NULL, 'MAD', 'per_booking', 1, 1, 24, true,
        '{apartment,villa,riad,studio,other}', '{}'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Demo Organization
INSERT INTO public.organizations (id, name, slug, default_currency, default_timezone, default_language, contact_email)
VALUES (
    '20000000-0000-4000-8000-000000000001',
    'Atlas & Coast Hospitality Morocco',
    'atlas-coast-morocco',
    'MAD',
    'Africa/Casablanca',
    'en',
    'concierge@staybeldi-demo.ma'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Custom Organization Catalogue Service (Isolated to Demo Organization)
INSERT INTO public.service_catalog (
    id, organization_id, is_global_template, category_key,
    name_en, name_fr, description_en, description_fr,
    default_image_url, default_pricing_mode, suggested_price, default_currency,
    default_pricing_unit, default_min_quantity, default_max_quantity,
    default_advance_notice_hours, requires_time_slot,
    recommended_property_types, recommended_features
)
VALUES (
    '10000000-0000-4000-8000-000000000099',
    '20000000-0000-4000-8000-000000000001',
    false,
    'activities',
    'Sunset Dunes Tea & Acoustic Gnawa Session',
    'Thé au Coucher du Soleil dans les Dunes & Session Gnawa',
    'Curated golden-hour coastal dunes picnic with saffron mint tea, Moroccan pastries, and acoustic Gnawa music.',
    'Pique-nique au coucher du soleil sur les dunes côtières avec thé au safran, pâtisseries beldi et musique acoustique.',
    'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?auto=format&fit=crop&w=900&q=80',
    'fixed', 420.00, 'MAD', 'per_person', 2, 8, 24, true,
    '{apartment,villa,studio}', '{beach_proximity,terrace}'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Three Demo Properties (Agadir Apartment, Marrakech Villa, Tamraght Coastal Apartment)
INSERT INTO public.properties (
    id, organization_id, name, slug,
    description_en, description_fr,
    welcome_message_en, welcome_message_fr,
    property_type, city, map_url, photos, features,
    default_whatsapp, default_whatsapp_label, is_demo_contact,
    timezone, currency, status
)
VALUES
    (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'Islan Apartment',
        'islan-apartment',
        'Sun-drenched contemporary beldi apartment in Agadir Marina District, steps from the Atlantic promenade with a private terrace and artisan cedar finishes.',
        'Appartement contemporain au style beldi chic à Agadir Marina, à quelques pas de la promenade atlantique avec terrasse ensoleillée et boiseries en cèdre.',
        'Merhba! Welcome to Islan Apartment in Agadir. Browse our curated à-la-carte services below to make your coastal stay effortless.',
        'Merhba ! Bienvenue à Islan Apartment à Agadir. Découvrez nos services à la carte ci-dessous pour enrichir votre séjour.',
        'apartment',
        'Agadir',
        'https://maps.google.com/?q=Agadir+Marina+Morocco',
        ARRAY[
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
        ],
        ARRAY['kitchen', 'beach_proximity', 'terrace', 'wifi', 'air_conditioning'],
        '+212600000001',
        'Youssef — Agadir Host (Demo Contact)',
        true,
        'Africa/Casablanca',
        'MAD',
        'published'
    ),
    (
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        'Villa Dar Zellig Palmeraie',
        'marrakech-villa',
        'Architectural terracotta sanctuary set in an olive grove in Marrakech Palmeraie. Features a heated zellig swimming pool, private marble hammam, and outdoor dining pavilion.',
        'Sanctuaire architectural en terre cuite au cœur d''une oliveraie de la Palmeraie de Marrakech. Piscine en zellige, hammam privé en marbre et jardin luxuriant.',
        'Welcome to Villa Dar Zellig. From private Dada dinners to traditional hammam rituals, request any service below and our Marrakech concierge will coordinate everything.',
        'Bienvenue à la Villa Dar Zellig. Du dîner préparé par notre Dada au rituel hammam privé, commandez vos prestations en quelques clics.',
        'villa',
        'Marrakech',
        'https://maps.google.com/?q=Palmeraie+Marrakech+Morocco',
        ARRAY[
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
        ],
        ARRAY['pool', 'hammam', 'garden', 'kitchen', 'terrace', 'parking'],
        '+212600000002',
        'Kenza — Marrakech Villa Concierge (Demo Contact)',
        true,
        'Africa/Casablanca',
        'MAD',
        'published'
    ),
    (
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001',
        'Tamraght Ocean Breeze Apartment',
        'tamraght-coastal-apartment',
        'Laid-back coastal hideaway overlooking Devil''s Rock and Banana Point in Tamraght. Designed for surf lovers and slow-living travellers with panoramic ocean views.',
        'Refuge côtier surplombant Devil''s Rock et Banana Point à Tamraght. Pensé pour les amateurs de surf et de slow travel avec vue panoramique sur l''océan.',
        'Ahlan! Welcome to Tamraght Ocean Breeze. Book morning beldi breakfast, surf coaching, or airport pick-up directly through WhatsApp.',
        'Ahlan ! Bienvenue à Tamraght Ocean Breeze. Réservez votre petit-déjeuner beldi, vos cours de surf ou votre transfert aéroport en un clic.',
        'apartment',
        'Tamraght',
        'https://maps.google.com/?q=Tamraght+Agadir+Morocco',
        ARRAY[
            'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
        ],
        ARRAY['beach_proximity', 'kitchen', 'terrace', 'surf_rack', 'wifi'],
        '+212600000003',
        'Mehdi — Tamraght Host (Demo Contact)',
        true,
        'Africa/Casablanca',
        'MAD',
        'published'
    )
ON CONFLICT (id) DO NOTHING;

-- 6. Property Services (Property-specific pricing, conditions, and WhatsApp routing overrides)
INSERT INTO public.property_services (
    id, property_id, organization_id, catalog_service_id, category_key,
    name_en, name_fr, description_en, description_fr,
    conditions_en, conditions_fr, image_url,
    is_active, pricing_mode, price, currency, pricing_unit,
    min_quantity, max_quantity, advance_notice_hours, requires_time_slot,
    display_order, whatsapp_override, whatsapp_override_label, is_demo_override_contact
)
VALUES
    -- Islan Apartment (Agadir) Services
    (
        '40000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        'food_drinks',
        'Breakfast',
        'Petit-déjeuner Beldi',
        'Served warm to your apartment terrace: msemen, baghrir, amlou, Souss honey, eggs to order, fresh Agadir orange juice, and mint tea.',
        'Servi chaud sur votre terrasse : msemen, baghrir, amlou, miel du Souss, œufs au choix, jus d''orange pressé d''Agadir et thé à la menthe.',
        'Delivered between 08:00 and 11:00. Please mention any dietary restrictions or vegetarian preferences in your note.',
        'Livré entre 08h00 et 11h00. Merci de préciser vos allergies ou préférences végétariennes en commentaire.',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 75.00, 'MAD', 'per_person', 1, 6, 12, true,
        1, '+212600000011', 'Fatima — Agadir Kitchen Partner (Demo Override)', true
    ),
    (
        '40000000-0000-4000-8000-000000000002',
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'transport',
        'Agadir Al-Massira Airport Transfer',
        'Transfert Aéroport Agadir Al-Massira',
        'Private Mercedes Vito pickup or drop-off between Agadir Al-Massira Airport (AGA) and Islan Apartment (up to 6 passengers).',
        'Chauffeur privé en Mercedes Vito entre l''aéroport Agadir Al-Massira (AGA) et Islan Apartment (jusqu''à 6 passagers).',
        'Please share your flight number and arrival/departure time in the note field.',
        'Veuillez indiquer votre numéro de vol et l''heure souhaitée dans la note.',
        'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 250.00, 'MAD', 'per_booking', 1, 2, 12, true,
        2, NULL, NULL, false
    ),
    (
        '40000000-0000-4000-8000-000000000003',
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000004',
        'cleaning',
        'Mid-Stay Housekeeping & Towel Refresh',
        'Ménage Intermédiaire & Linge Frais',
        'Complete apartment cleaning and fresh bath/beach towel replacement by our housekeeping team.',
        'Ménage complet de l''appartement et renouvellement des serviettes de bain et de plage.',
        'Available Monday through Saturday between 10:00 and 16:00.',
        'Disponible du lundi au samedi entre 10h00 et 16h00.',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 180.00, 'MAD', 'per_booking', 1, 1, 18, true,
        3, NULL, NULL, false
    ),
    (
        '40000000-0000-4000-8000-000000000004',
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000006',
        'property_extras',
        'Late Checkout (Until 16:00)',
        'Départ Tardif (Jusqu''à 16h00)',
        'Keep the apartment keys until 16:00 on your departure day instead of standard 11:00 checkout.',
        'Conservez l''appartement jusqu''à 16h00 le jour de votre départ au lieu de 11h00.',
        'Subject to same-day incoming check-in schedule. Host will confirm availability.',
        'Sous réserve qu''aucune arrivée ne soit prévue le même jour. L''hôte vous confirmera la disponibilité.',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 250.00, 'MAD', 'per_booking', 1, 1, 24, false,
        4, NULL, NULL, false
    ),

    -- Villa Dar Zellig Palmeraie (Marrakech) Services
    (
        '40000000-0000-4000-8000-000000000005',
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000003',
        'food_drinks',
        'Private Dada Moroccan Feast',
        'Dîner Marocain par notre Cheffe Dada',
        'Our resident Dada prepares an unforgettable three-course Marrakech feast (Briouates, Tanjia Marrakchia or Lamb Tagine with Prunes, and Pastilla au Lait).',
        'Notre Dada prépare un dîner marrakchi en trois services (Assortiment de salades & briouates, Tanjia ou Tajine d''agneau aux pruneaux, Pastilla au lait).',
        'Quote includes fresh souk ingredients, cooking, table service, and kitchen cleanup. Please specify menu preferences.',
        'Le devis inclut les courses au souk, la préparation, le service à table et le rangement de la cuisine.',
        'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=900&q=80',
        true, 'quote', NULL, 'MAD', 'per_person', 2, 12, 24, true,
        1, '+212600000022', 'Chef Halima — Marrakech Culinary Team (Demo Override)', true
    ),
    (
        '40000000-0000-4000-8000-000000000006',
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000009',
        'wellness',
        'Private Villa Hammam & Savon Beldi Ritual',
        'Rituel Hammam Privé & Gommage au Savon Noir',
        'We heat the villa marble hammam and bring an experienced Kessala therapist for a 60-minute steam, eucalyptus black soap scrub, and orange blossom ghassoul wrap.',
        'Mise en chauffe du hammam de la villa avec praticienne Kessala pour 60 min de vapeur, gommage au savon noir à l''eucalyptus et enveloppement au rhassoul.',
        'Requires 24h notice to heat the marble steam room and schedule your therapist.',
        'Nécessite 24h de préavis pour chauffer le hammam et planifier la venue de la praticienne.',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 550.00, 'MAD', 'per_person', 1, 4, 24, true,
        2, '+212600000023', 'Nadia — Marrakech Wellness Spa Team (Demo Override)', true
    ),
    (
        '40000000-0000-4000-8000-000000000007',
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000010',
        'property_extras',
        'Private Zellig Pool Heating (29°C)',
        'Chauffage de la Piscine en Zellige (29°C)',
        'Heat the outdoor Palmeraie swimming pool to a soothing 29°C day and night. Minimum 2 consecutive nights.',
        'Chauffage de la piscine extérieure à 29°C jour et nuit. Minimum de 2 nuits consécutives.',
        'Please request at least 48 hours prior to enable heat pump ramp-up.',
        'Merci de commander au moins 48h à l''avance pour la montée en température de la pompe à chaleur.',
        'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 400.00, 'MAD', 'per_night', 2, 14, 48, false,
        3, NULL, NULL, false
    ),
    (
        '40000000-0000-4000-8000-000000000008',
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        'food_drinks',
        'Palmeraie Garden Breakfast',
        'Petit-déjeuner au Jardin de la Palmeraie',
        'Lavish poolside breakfast spread with freshly baked Moroccan breads, Berber omelette, seasonal fruits, almond pastries, and fresh juices.',
        'Petit-déjeuner servi au bord de la piscine : crêpes marocaines chaudes, omelette berbère, fruits frais, pâtisseries aux amandes et jus pressés.',
        'Served between 08:30 and 11:30 in the garden pavilion.',
        'Servi entre 08h30 et 11h30 sous le pavillon du jardin.',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 120.00, 'MAD', 'per_person', 2, 10, 14, true,
        4, NULL, NULL, false
    ),

    -- Tamraght Ocean Breeze Apartment Services
    (
        '40000000-0000-4000-8000-000000000009',
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000011',
        'activities',
        'Tamraght & Taghazout Surf Coaching Session',
        'Session Surf Coaching à Tamraght & Taghazout',
        '2.5-hour guided surf lesson at Devil''s Rock, Croco Beach, or Panorama with board, RipCurl wetsuit, and pickup from the apartment.',
        'Cours de surf de 2h30 à Devil''s Rock, Croco Beach ou Panorama avec planche, combinaison RipCurl et départ depuis l''appartement.',
        'Please mention your surf level (Beginner, Intermediate, Advanced) and approximate height/weight for wetsuit sizing.',
        'Merci d''indiquer votre niveau (Débutant, Intermédiaire, Avancé) ainsi que votre taille pour la combinaison.',
        'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 300.00, 'MAD', 'per_person', 1, 6, 12, true,
        1, '+212600000031', 'Amine — Tamraght Surf Club Coach (Demo Override)', true
    ),
    (
        '40000000-0000-4000-8000-000000000010',
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000099',
        'activities',
        'Sunset Dunes Tea & Acoustic Gnawa Session',
        'Thé au Coucher du Soleil & Musique Gnawa',
        'Golden hour excursion to Timlalin coastal dunes with traditional saffron mint tea, amlou pastries, and live acoustic guembri music.',
        'Sortie au coucher du soleil aux dunes de Timlalin avec thé à la menthe safrané, pâtisseries beldi et musique acoustique.',
        'Departures at 16:30 daily except Wednesdays.',
        'Départ à 16h30 tous les jours sauf le mercredi.',
        'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?auto=format&fit=crop&w=900&q=80',
        true, 'fixed', 420.00, 'MAD', 'per_person', 2, 6, 24, true,
        2, NULL, NULL, false
    ),
    (
        '40000000-0000-4000-8000-000000000011',
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000012',
        'activities',
        'Paradise Valley Oasis & Honey Road Excursion',
        'Excursion Vallée du Paradis & Route du Miel',
        'Half-day private 4x4 trip through the Atlas foothills to Paradise Valley natural rock pools and Imouzzer argan/honey cooperatives.',
        'Excursion privée en 4x4 vers les piscines naturelles de la Vallée du Paradis et les coopératives d''argan et de miel d''Imouzzer.',
        'Custom quote based on group size and optional traditional tagine lunch by the river.',
        'Tarif sur devis selon la taille du groupe et option déjeuner tajine au bord de l''oued.',
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=900&q=80',
        true, 'quote', NULL, 'MAD', 'per_booking', 1, 1, 18, true,
        3, NULL, NULL, false
    )
ON CONFLICT (id) DO NOTHING;

-- 7. Sample Service Requests (Demonstrating statuses & metrics)
INSERT INTO public.service_requests (
    id, reference_code, organization_id, property_id, property_service_id,
    property_name_snapshot, service_name_snapshot, category_key_snapshot,
    pricing_mode_snapshot, unit_price_snapshot, pricing_unit_snapshot, currency,
    guest_name, requested_date, requested_time, quantity, estimated_total,
    guest_note, guest_locale, resolved_whatsapp_number, resolved_whatsapp_label,
    used_override_recipient, is_demo_recipient, status, whatsapp_handoff_at, manager_notes
)
VALUES
    (
        '50000000-0000-4000-8000-000000000001',
        'SB-8492KL',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'Islan Apartment',
        'Breakfast',
        'food_drinks',
        'fixed',
        75.00,
        'per_person',
        'MAD',
        'Sarah (Demo Guest)',
        '2026-10-22',
        '09:00',
        2,
        150.00,
        'One vegetarian breakfast',
        'en',
        '+212600000011',
        'Fatima — Agadir Kitchen Partner (Demo Override)',
        true,
        true,
        'confirmed',
        now() - interval '2 days',
        'Confirmed with Fatima for 09:00 terrace delivery.'
    ),
    (
        '50000000-0000-4000-8000-000000000002',
        'SB-3910MX',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000006',
        'Villa Dar Zellig Palmeraie',
        'Private Villa Hammam & Savon Beldi Ritual',
        'wellness',
        'fixed',
        550.00,
        'per_person',
        'MAD',
        'Marc & Claire (Demo Guest)',
        '2026-10-24',
        '17:00',
        2,
        1100.00,
        'Would love orange blossom water after the session.',
        'fr',
        '+212600000023',
        'Nadia — Marrakech Wellness Spa Team (Demo Override)',
        true,
        true,
        'confirmed',
        now() - interval '1 day',
        'Therapist Nadia booked for 17:00.'
    ),
    (
        '50000000-0000-4000-8000-000000000003',
        'SB-7721TR',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000003',
        '40000000-0000-4000-8000-000000000009',
        'Tamraght Ocean Breeze Apartment',
        'Tamraght & Taghazout Surf Coaching Session',
        'activities',
        'fixed',
        300.00,
        'per_person',
        'MAD',
        'Lucas (Demo Guest)',
        '2026-10-21',
        '09:30',
        2,
        600.00,
        'Two intermediate surfers, sizes M and L wetsuits.',
        'en',
        '+212600000031',
        'Amine — Tamraght Surf Club Coach (Demo Override)',
        true,
        true,
        'prepared',
        now() - interval '3 hours',
        'Awaiting WhatsApp confirmation from guest.'
    ),
    (
        '50000000-0000-4000-8000-000000000004',
        'SB-5104DZ',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000005',
        'Villa Dar Zellig Palmeraie',
        'Private Dada Moroccan Feast',
        'food_drinks',
        'quote',
        NULL,
        'per_person',
        'MAD',
        'Elena (Demo Guest)',
        '2026-10-25',
        '20:00',
        4,
        NULL,
        'Interested in Lamb Tagine with prunes and almonds for 4 adults.',
        'en',
        '+212600000022',
        'Chef Halima — Marrakech Culinary Team (Demo Override)',
        true,
        true,
        'prepared',
        now() - interval '1 hour',
        ''
    )
ON CONFLICT (id) DO NOTHING;

-- 8. Property Service Availability Windows
INSERT INTO public.property_service_availability (
    property_service_id, weekday, start_time, end_time, is_available
)
SELECT
    ps.id,
    w.weekday,
    CASE
        WHEN ps.category_key = 'food_drinks' AND ps.name_en ILIKE '%Breakfast%' THEN '08:00'::time
        WHEN ps.category_key = 'food_drinks' THEN '18:00'::time
        WHEN ps.category_key = 'cleaning' THEN '10:00'::time
        WHEN ps.category_key = 'wellness' THEN '10:00'::time
        WHEN ps.category_key = 'activities' THEN '08:30'::time
        ELSE '07:00'::time
    END,
    CASE
        WHEN ps.category_key = 'food_drinks' AND ps.name_en ILIKE '%Breakfast%' THEN '11:30'::time
        WHEN ps.category_key = 'food_drinks' THEN '22:00'::time
        WHEN ps.category_key = 'cleaning' THEN '16:00'::time
        WHEN ps.category_key = 'wellness' THEN '20:00'::time
        WHEN ps.category_key = 'activities' THEN '18:30'::time
        ELSE '22:00'::time
    END,
    CASE
        -- Example: Housekeeping closed on Sundays (weekday 0), Sunset Dunes closed on Wednesdays (weekday 3)
        WHEN ps.id = '40000000-0000-4000-8000-000000000003' AND w.weekday = 0 THEN false
        WHEN ps.id = '40000000-0000-4000-8000-000000000010' AND w.weekday = 3 THEN false
        ELSE true
    END
FROM public.property_services ps
CROSS JOIN (SELECT generate_series(0, 6) AS weekday) w
ON CONFLICT DO NOTHING;

-- 9. Sample Property Service Blackout Dates
INSERT INTO public.property_service_blackouts (
    property_service_id, unavailable_date, reason
)
VALUES
    ('40000000-0000-4000-8000-000000000001', '2026-10-28', 'Kitchen partner annual maintenance day'),
    ('40000000-0000-4000-8000-000000000006', '2026-10-29', 'Hammam steam boiler descaling'),
    ('40000000-0000-4000-8000-000000000009', '2026-10-30', 'Regional surf competition day')
ON CONFLICT (property_service_id, unavailable_date) DO NOTHING;
