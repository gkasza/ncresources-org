/* NC Resources — client-side filter, bilingual EN/ES UI, category discovery & render
 * Pure vanilla JS, zero third-party dependencies, strict CSP compliant.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const placeTypeEl = $("placeType");
  const placeValueEl = $("placeValue");
  const bucketEl = $("bucket");
  const searchEl = $("search");
  const clearBtn = $("clear");
  const statusEl = $("status");
  const toolbarEl = $("toolbar");
  const resultsEl = $("results");
  const homeDiscoveryEl = $("homeDiscovery");
  const categoryGridEl = $("categoryGrid");
  const quickPlaceChipsEl = $("quickPlaceChips");
  const statewideSectionEl = $("statewideSection");
  const statewideListEl = $("statewideList");
  const statewideHeadingEl = $("statewideHeading");
  const viewStatewideBtn = $("viewStatewideBtn");
  const allCategoriesBtn = $("allCategoriesBtn");
  const printBtn = $("printBtn");
  const printHeaderEl = $("printHeader");
  const dataDateEl = $("data-date");
  const statTotalEl = $("statTotal");
  const statBucketsEl = $("statBuckets");
  const toastEl = $("toast");

  let dataset = null;
  let detailsCache = null;
  let detailsPromise = null;
  let currentLang = "en";
  let toastTimer = null;

  const POPULAR_CITIES = [
    "Raleigh",
    "Durham",
    "Charlotte",
    "Greensboro",
    "Asheville",
    "Fayetteville",
    "Winston-Salem",
    "Wilmington",
    "Chapel Hill",
    "Greenville",
  ];

  const POPULAR_COUNTIES = [
    "Wake",
    "Durham",
    "Mecklenburg",
    "Guilford",
    "Buncombe",
    "Cumberland",
    "Forsyth",
    "New Hanover",
    "Orange",
    "Pitt",
  ];

  // Acronyms preserved during title-case normalization of ALL-CAPS agency names
  const ACRONYMS = new Set([
    "NC", "USA", "US", "YMCA", "YWCA", "DSS", "WIC", "SNAP", "FNS", "VA", "VITA",
    "AARP", "UNC", "ESL", "GED", "HIV", "AIDS", "HUD", "SRO", "DV", "EBT", "OTC",
    "LIEAP", "CIP", "SSI", "SSDI", "TEFAP", "DCRC", "CCSA", "NCAFCC", "NCCADV",
    "MANNA", "BRACE", "NC4VETS", "UMC", "AME", "PCUSA", "LGBTQ", "II", "III", "IV",
    "NW", "NE", "SW", "SE", "PO", "LLC", "INC", "ST", "MT", "HQ", "CC", "BATS",
    "LANC", "CARE", "HOPE", "STEP", "ACTS", "SHIIP", "DHS", "HHS", "DHHS", "DPS",
  ]);
  const MINOR_WORDS = new Set(["of", "the", "and", "in", "for", "at", "by", "to", "on", "a", "an", "or"]);

  // Crisp inline SVG icons (18px / 20px, zero external assets)
  const ICONS = {
    food: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
    housing: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    shelter: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    utilities: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    health: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>',
    crisis: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    legal: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
    family: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    baby: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>',
    clothing: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
    transit: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>',
    hygiene: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z"/><path d="M4 18v2"/><path d="M20 18v2"/></svg>',
    tax: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>',
    other: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  };

  const CATEGORY_META = {
    "Food & Meals": {
      icon: "food", tone: "amber",
      es: "Comida y Despensas",
      descEn: "Food pantries, hot meals, mobile markets & groceries",
      descEs: "Despensas de alimentos, comidas calientes y mercados móviles",
    },
    "Rent / Housing Assistance": {
      icon: "housing", tone: "blue",
      es: "Alquiler y Vivienda",
      descEn: "Rent help, housing authorities, Section 8 & stability",
      descEs: "Ayuda con alquiler, autoridades de vivienda y Sección 8",
    },
    "Shelter": {
      icon: "shelter", tone: "indigo",
      es: "Refugio de Emergencia",
      descEn: "Emergency family & adult shelters, transitional housing",
      descEs: "Refugios familiares y de emergencia, vivienda transicional",
    },
    "Utilities": {
      icon: "utilities", tone: "amber",
      es: "Luz, Gas y Agua",
      descEn: "Electric, gas, water bills, LIEAP & weatherization",
      descEs: "Facturas de electricidad, gas, agua, LIEAP y climatización",
    },
    "Healthcare / Medicaid": {
      icon: "health", tone: "pine",
      es: "Salud y Medicaid",
      descEn: "Free clinics, Medicaid, NC MedAssist free pharmacy",
      descEs: "Clínicas gratuitas, Medicaid y farmacia gratis NC MedAssist",
    },
    "Mental Health & Crisis": {
      icon: "crisis", tone: "crimson",
      es: "Salud Mental y Crisis",
      descEn: "988, 24/7 domestic violence shelters, peer & veteran lines",
      descEs: "988, refugios de violencia doméstica 24/7 y líneas de apoyo",
    },
    "Legal Aid & Eviction Defense": {
      icon: "legal", tone: "indigo",
      es: "Ayuda Legal y Desalojos",
      descEn: "Free eviction defense, fair housing, benefits & family law",
      descEs: "Defensa contra desalojos, vivienda justa y ayuda legal gratis",
    },
    "Childcare & Family Support": {
      icon: "family", tone: "pine",
      es: "Cuidado Infantil y Familia",
      descEn: "DSS benefits, WIC, NC Pre-K, Smart Start, SUN Bucks & jobs",
      descEs: "DSS, WIC, NC Pre-K, Smart Start, SUN Bucks y empleo",
    },
    "Diapers & Baby Supplies": {
      icon: "baby", tone: "plum",
      es: "Pañales y Artículos de Bebé",
      descEn: "Diaper banks, wipes, formula & infant essentials",
      descEs: "Bancos de pañales, toallitas, fórmula y artículos infantiles",
    },
    "Clothing": {
      icon: "clothing", tone: "blue",
      es: "Ropa y Calzado",
      descEn: "Free family & school clothing closets, work attire",
      descEs: "Ropa escolar y familiar gratuita, calzado y vestimenta",
    },
    "Transportation": {
      icon: "transit", tone: "blue",
      es: "Transporte",
      descEn: "Medical rides, county transit & community paratransit",
      descEs: "Transporte médico, tránsito público y viajes comunitarios",
    },
    "Personal Care & Hygiene": {
      icon: "hygiene", tone: "plum",
      es: "Higiene Personal",
      descEn: "Toiletries, period products, showers & laundry",
      descEs: "Artículos de aseo, productos menstruales y lavandería",
    },
    "Household Goods": {
      icon: "home", tone: "amber",
      es: "Artículos del Hogar",
      descEn: "Furniture, beds, kitchenware & home essentials",
      descEs: "Muebles, camas, utensilios y artículos básicos del hogar",
    },
    "Tax & Financial Help": {
      icon: "tax", tone: "pine",
      es: "Impuestos y Finanzas",
      descEn: "Free IRS VITA tax prep, MyFreeTaxes & disaster aid",
      descEs: "Declaración de impuestos gratis (VITA) y apoyo financiero",
    },
    "Other": {
      icon: "other", tone: "blue",
      es: "Otros Recursos",
      descEn: "Summer meals, disaster recovery & local community aid",
      descEs: "Comidas de verano, alivio de desastres y ayuda local",
    },
  };

  const I18N = {
    en: {
      skipLink: "Skip to search & filters",
      urgentLabel: "Need help right now?",
      urgent911: "Emergency",
      urgent211: "24/7 Referrals",
      urgent988: "Crisis Lifeline",
      brandTagline: "Free community help · North Carolina",
      navAbout: "About",
      heroTitle: "Find free help across North Carolina.",
      heroSub: "Pick your area or choose a category below. No account, no ads, no tracking.",
      statPrograms: "verified listings",
      statCounties: "NC counties",
      statCategories: "help categories",
      labelWhere: "Browse by",
      optCity: "City",
      optCounty: "County",
      labelNeed: "What you need",
      labelSearch: "Search by name, program, or keyword",
      searchPlaceholder: "e.g. Legal Aid, WIC, Food Bank, Hope House",
      btnClear: "Clear",
      quickAreas: "Quick areas:",
      statewideChip: "Statewide NC",
      btnAllCategories: "All categories",
      btnPrint: "Print list",
      browseHeading: "Browse by type of help",
      browseSub: "Tap any category to see local and statewide programs.",
      spotlightEyebrow: "Available in all 100 NC counties",
      spotlightTitle: "Statewide programs you can apply for today",
      spotlightSub: "SNAP, Medicaid, heating bills (LIEAP), free eviction defense, free prescription medicine, WIC, and free tax filing.",
      spotlightBtn: "View all statewide programs",
      spotlightEpass: "Apply on NC ePASS ↗",
      resultsHeading: "Results",
      statewideBadge: "Statewide NC",
      alsoStatewide: "Also available in every NC county",
      alsoStatewideSub: "These statewide helplines and portals serve residents anywhere in North Carolina.",
      anyCity: "Any city",
      anyCounty: "Any county",
      anyNeed: "Any kind of help",
      loadingAgencies: "Loading agencies…",
      loadingShort: "Loading…",
      loadingDir: "Loading directory…",
      agencySingular: "agency",
      agencyPlural: "agencies",
      inPlace: "in",
      inAnyCounty: "in any NC county",
      acrossNC: "across NC",
      matching: "matching",
      noMatchesTitle: "No local matches found.",
      noMatchesBody: "Try switching between City and County, picking a broader category, or clearing your search.",
      noMatches211: "For 24/7 free referrals across NC, dial",
      addrMissing: "Address not listed — call before visiting",
      whoLabel: "Who:",
      bringLabel: "Bring:",
      howLabel: "How:",
      noteLabel: "Note:",
      callBtn: "Call",
      call211Btn: "Call 2-1-1 first",
      directionsBtn: "Directions",
      websiteBtn: "Website",
      shareBtn: "Share",
      detailsOpen: "Program details",
      detailsHide: "Hide details",
      lastChecked: "Last checked:",
      copiedToast: "Copied listing details — ready to paste or text",
      noContactWarn: "We don't have a phone or website for this location. Call 2-1-1 to verify before going.",
      footUrgentStrong: "Need help right now?",
      footUrgentBody: "Dial",
      footUrgentOr: "for emergencies,",
      footUrgentCrisis: "for mental health & crisis support, or",
      footUrgent211: "for 24/7 community referrals.",
      footFreeStrong: "This is a free public service.",
      footDisclaimer: "Information was gathered from each agency's own website, NC DHHS county directories, and public referral networks. Agency hours, phone numbers, and funding change frequently.",
      footCallFirst: "Please call before going.",
      footBuilt: "Built with",
      footBy: "by Diana K. & family in Durham, NC",
      footUpdated: "Updated",
      footAbout: "About this directory & hotlines",
    },
    es: {
      skipLink: "Ir a búsqueda y filtros",
      urgentLabel: "¿Necesitas ayuda ahora?",
      urgent911: "Emergencia",
      urgent211: "Referencias 24/7",
      urgent988: "Línea de Crisis",
      brandTagline: "Ayuda comunitaria gratis · Carolina del Norte",
      navAbout: "Acerca de",
      heroTitle: "Encuentra ayuda gratuita en Carolina del Norte.",
      heroSub: "Elige tu área o una categoría abajo. Sin cuenta, sin anuncios y sin rastreo.",
      statPrograms: "recursos verificados",
      statCounties: "condados de NC",
      statCategories: "categorías de ayuda",
      labelWhere: "Buscar por",
      optCity: "Ciudad",
      optCounty: "Condado",
      labelNeed: "Qué necesitas",
      labelSearch: "Buscar por nombre, programa o palabra clave",
      searchPlaceholder: "ej. Legal Aid, WIC, comida, renta",
      btnClear: "Limpiar",
      quickAreas: "Áreas rápidas:",
      statewideChip: "Todo NC (Estatal)",
      btnAllCategories: "Ver categorías",
      btnPrint: "Imprimir lista",
      browseHeading: "Explora por tipo de ayuda",
      browseSub: "Toca cualquier categoría para ver programas locales y estatales.",
      spotlightEyebrow: "Disponible en los 100 condados de NC",
      spotlightTitle: "Programas estatales que puedes solicitar hoy",
      spotlightSub: "SNAP, Medicaid, ayuda de calefacción (LIEAP), defensa legal contra desalojos, medicinas gratis, WIC e impuestos gratis.",
      spotlightBtn: "Ver programas estatales",
      spotlightEpass: "Solicitar en NC ePASS ↗",
      resultsHeading: "Resultados",
      statewideBadge: "Estatal NC",
      alsoStatewide: "También disponible en todo Carolina del Norte",
      alsoStatewideSub: "Estas líneas de ayuda y portales estatales atienden a residentes en los 100 condados.",
      anyCity: "Cualquier ciudad",
      anyCounty: "Cualquier condado",
      anyNeed: "Cualquier tipo de ayuda",
      loadingAgencies: "Cargando agencias…",
      loadingShort: "Cargando…",
      loadingDir: "Cargando directorio…",
      agencySingular: "agencia",
      agencyPlural: "agencias",
      inPlace: "en",
      inAnyCounty: "en cualquier condado de NC",
      acrossNC: "en todo NC",
      matching: "con",
      noMatchesTitle: "No se encontraron resultados locales.",
      noMatchesBody: "Prueba cambiar entre Ciudad y Condado, elegir otra categoría o borrar tu búsqueda.",
      noMatches211: "Para referencias gratuitas 24/7 en español, llama al",
      addrMissing: "Dirección no disponible — llama antes de ir",
      whoLabel: "Quiénes:",
      bringLabel: "Llevar:",
      howLabel: "Cómo:",
      noteLabel: "Nota:",
      callBtn: "Llamar",
      call211Btn: "Llama al 2-1-1",
      directionsBtn: "Cómo llegar",
      websiteBtn: "Sitio web",
      shareBtn: "Compartir",
      detailsOpen: "Ver detalles",
      detailsHide: "Ocultar detalles",
      lastChecked: "Verificado:",
      copiedToast: "Copiado — listo para pegar o enviar por mensaje",
      noContactWarn: "No tenemos teléfono ni sitio web para este lugar. Llama al 2-1-1 para confirmar antes de ir.",
      footUrgentStrong: "¿Necesitas ayuda ahora?",
      footUrgentBody: "Llama al",
      footUrgentOr: "para emergencias,",
      footUrgentCrisis: "para crisis de salud mental, o al",
      footUrgent211: "para referencias 24/7 en español.",
      footFreeStrong: "Este es un servicio público gratuito.",
      footDisclaimer: "La información fue recopilada de los sitios de cada agencia, directorios de NC DHHS y redes públicas. Los horarios y teléfonos cambian con frecuencia.",
      footCallFirst: "Por favor llama antes de ir.",
      footBuilt: "Hecho con",
      footBy: "por Diana K. y familia en Durham, NC",
      footUpdated: "Actualizado",
      footAbout: "Acerca del directorio y líneas de ayuda",
    },
  };

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  }

  function catLabel(bucket) {
    if (currentLang === "es" && CATEGORY_META[bucket] && CATEGORY_META[bucket].es) {
      return CATEGORY_META[bucket].es;
    }
    return bucket;
  }

  function catDesc(bucket) {
    const m = CATEGORY_META[bucket];
    if (!m) return "";
    return currentLang === "es" ? m.descEs : m.descEn;
  }

  function loadDetails() {
    if (detailsCache) return Promise.resolve(detailsCache);
    if (detailsPromise) return detailsPromise;
    detailsPromise = fetch("/details.json", { cache: "default" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        detailsCache = data;
        return data;
      })
      .catch((err) => {
        console.error("details.json fetch failed:", err);
        detailsCache = {};
        return detailsCache;
      });
    return detailsPromise;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Format ALL-CAPS agency names gently into readable title case while preserving acronyms
  function formatAgencyName(name) {
    if (!name) return "";
    const letters = name.replace(/[^a-zA-Z]/g, "");
    if (!letters) return name;
    const upperRatio = (letters.match(/[A-Z]/g) || []).length / letters.length;
    if (upperRatio < 0.85 || letters.length < 5) return name;

    const words = name.split(/(\s+|-|\/)/);
    let wordIndex = 0;
    return words
      .map((part) => {
        if (/^(\s+|-|\/)$/.test(part)) return part;
        const clean = part.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const isFirst = wordIndex === 0;
        wordIndex++;
        if (ACRONYMS.has(clean)) return part.toUpperCase();
        const lower = part.toLowerCase();
        if (!isFirst && MINOR_WORDS.has(lower)) return lower;
        return lower.replace(/[a-z]/, (c) => c.toUpperCase());
      })
      .join("");
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
  }

  function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (k) el.textContent = t(k);
    });
    if (searchEl) searchEl.placeholder = t("searchPlaceholder");

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function syncSegmented(placeType) {
    document.querySelectorAll(".seg-btn").forEach((btn) => {
      const active = btn.dataset.placeType === placeType;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function readState() {
    return {
      placeType: placeTypeEl.value,
      placeValue: placeValueEl.value || "",
      bucket: bucketEl.value || "",
      search: (searchEl && searchEl.value || "").trim(),
      lang: currentLang,
    };
  }

  function urlFromState(s) {
    const params = new URLSearchParams();
    if (s.placeType !== "city") params.set("place", s.placeType);
    if (s.placeValue) params.set(s.placeType, s.placeValue);
    if (s.bucket) params.set("need", s.bucket);
    if (s.search) params.set("q", s.search);
    if (s.lang === "es") params.set("lang", "es");
    const qs = params.toString();
    return qs ? `?${qs}` : "/";
  }

  function stateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = { placeType: "city", placeValue: "", bucket: "", search: "", lang: "en" };
    if (params.get("place") === "county") s.placeType = "county";
    s.placeValue = params.get(s.placeType) || "";
    s.bucket = params.get("need") || "";
    s.search = (params.get("q") || "").trim();
    if (params.get("lang") === "es") s.lang = "es";
    return s;
  }

  function computeFacetCounts(state) {
    const placeKey = state.placeType === "county" ? "county" : "city";
    const buckets = Object.create(null);
    const places = Object.create(null);

    for (const r of dataset.rows) {
      const matchesPlace = !state.placeValue || (r[placeKey] || "") === state.placeValue;
      const matchesBucket = !state.bucket || (r.bucket || "") === state.bucket;

      if (matchesPlace) {
        const b = r.bucket || "Other";
        buckets[b] = (buckets[b] || 0) + 1;
      }
      if (matchesBucket) {
        const p = r[placeKey];
        if (p) places[p] = (places[p] || 0) + 1;
      }
    }
    return { buckets, places };
  }

  function renderQuickPlaces(state) {
    if (!quickPlaceChipsEl || !dataset) return;
    const list = state.placeType === "county" ? POPULAR_COUNTIES : POPULAR_CITIES;
    const avail = new Set(state.placeType === "county" ? dataset.facets.counties : dataset.facets.cities);
    const chips = [];

    for (const name of list) {
      if (!avail.has(name)) continue;
      const active = state.placeValue === name ? " is-active" : "";
      chips.push(`<button type="button" class="chip${active}" data-quick-place="${escapeHtml(name)}">${escapeHtml(name)}</button>`);
    }
    const swActive = state.placeValue === "Statewide" ? " is-active" : "";
    chips.push(`<button type="button" class="chip chip-statewide${swActive}" data-quick-place="Statewide">${escapeHtml(t("statewideChip"))}</button>`);
    quickPlaceChipsEl.innerHTML = chips.join("");
  }

  function renderCategoryGrid(counts) {
    if (!categoryGridEl || !dataset) return;
    const html = dataset.facets.buckets.map((b) => {
      const meta = CATEGORY_META[b] || { icon: "other", tone: "blue" };
      const count = counts.buckets[b] || 0;
      return `
        <button type="button" class="cat-card" data-bucket="${escapeHtml(b)}" data-tone="${meta.tone}">
          <span class="cat-icon">${ICONS[meta.icon] || ICONS.other}</span>
          <span class="cat-body">
            <span class="cat-top">
              <span class="cat-title">${escapeHtml(catLabel(b))}</span>
              <span class="cat-count">${count.toLocaleString()}</span>
            </span>
            <span class="cat-desc">${escapeHtml(catDesc(b))}</span>
          </span>
        </button>`;
    });
    categoryGridEl.innerHTML = html.join("");
  }

  function populateFacets(state) {
    const facets = dataset.facets;
    const counts = computeFacetCounts(state);

    syncSegmented(state.placeType);
    const placeValueLabel = $("placeValueLabel");
    if (placeValueLabel) {
      placeValueLabel.textContent = state.placeType === "county" ? t("optCounty") : t("optCity");
    }

    const fullList = state.placeType === "county" ? facets.counties : facets.cities;
    const totalForPlaceholder = Object.values(counts.places).reduce((a, b) => a + b, 0);
    const placeholder = state.placeType === "county"
      ? `${t("anyCounty")} (${totalForPlaceholder.toLocaleString()})`
      : `${t("anyCity")} (${totalForPlaceholder.toLocaleString()})`;

    placeValueEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    placeValueEl.appendChild(empty);

    for (const v of fullList) {
      const n = counts.places[v] || 0;
      if (n === 0 && v !== state.placeValue) continue;
      const o = document.createElement("option");
      o.value = v;
      const label = v === "Statewide" ? t("statewideChip") : v;
      o.textContent = `${label} (${n})`;
      if (v === state.placeValue) o.selected = true;
      placeValueEl.appendChild(o);
    }

    bucketEl.innerHTML = "";
    const totalAcross = Object.values(counts.buckets).reduce((a, b) => a + b, 0);
    const any = document.createElement("option");
    any.value = "";
    any.textContent = `${t("anyNeed")} (${totalAcross.toLocaleString()})`;
    bucketEl.appendChild(any);

    for (const b of facets.buckets) {
      const n = counts.buckets[b] || 0;
      if (n === 0 && b !== state.bucket) continue;
      const o = document.createElement("option");
      o.value = b;
      o.textContent = `${catLabel(b)} (${n})`;
      bucketEl.appendChild(o);
    }
    bucketEl.value = state.bucket;

    renderQuickPlaces(state);
    renderCategoryGrid(counts);
  }

  function matchesSearch(r, q) {
    if (!q) return true;
    const hay = [
      r.agency, r.program, r.bucket, r.address, r.city, r.county, r.eligibility, r.schedule,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function filterRows(state) {
    if (!state.placeValue && !state.bucket && !state.search) return null;
    const placeKey = state.placeType === "county" ? "county" : "city";
    const q = (state.search || "").toLowerCase();
    return dataset.rows.filter((r) => {
      if (state.placeValue && (r[placeKey] || "") !== state.placeValue) return false;
      if (state.bucket && (r.bucket || "") !== state.bucket) return false;
      if (!matchesSearch(r, q)) return false;
      return true;
    });
  }

  function filterStatewideSupplement(state) {
    if (!state.placeValue || state.placeValue === "Statewide") return [];
    const q = (state.search || "").toLowerCase();
    return dataset.rows.filter((r) => {
      if (r.county !== "Statewide" && r.city !== "Statewide") return false;
      if (state.bucket && (r.bucket || "") !== state.bucket) return false;
      if (!matchesSearch(r, q)) return false;
      return true;
    });
  }

  function flagFor(notes, noContact) {
    if (noContact) return "caution";
    if (!notes) return null;
    const n = notes.toLowerCase();
    if (n.includes("critical") || n.includes("safety-critical")) return "critical";
    if (
      n.includes("phone confirmation") ||
      n.includes("recommend phone") ||
      n.includes("dead") ||
      n.includes("appears dead") ||
      n.includes("waitlist") ||
      n.includes("closed") ||
      n.includes("audit ")
    ) return "caution";
    return null;
  }

  const SHORT_CODES = new Set(["211", "311", "411", "511", "611", "711", "811", "911", "988"]);
  function telHref(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (SHORT_CODES.has(digits)) return `tel:${digits}`;
    if (digits.length < 7) return null;
    return `tel:${digits.length === 10 ? "+1" + digits : digits}`;
  }

  function mapsHref(addr, city, zip) {
    if (!addr || city === "Statewide") return null;
    const parts = [addr, city, "NC", zip].filter(Boolean);
    if (!parts.length) return null;
    const q = encodeURIComponent(parts.join(", "));
    return `https://maps.apple.com/?q=${q}`;
  }

  function ensureProtocol(url) {
    if (!url) return null;
    const stripped = String(url).trim().replace(/^https?:\/\//i, "");
    if (/\s/.test(stripped)) return null;
    if (!/^[\w.-]+\.[a-z]{2,}/i.test(stripped)) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${stripped}`;
  }

  function formatVerifiedDate(s) {
    if (!s) return "";
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const months = currentLang === "es"
      ? ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return s;
    return currentLang === "es"
      ? `${parseInt(m[3], 10)} ${months[mi]} ${m[1]}`
      : `${months[mi]} ${parseInt(m[3], 10)}, ${m[1]}`;
  }

  function cardHTML(r) {
    const displayName = formatAgencyName(r.agency);
    const agencyEsc = escapeHtml(displayName);
    const tel = telHref(r.phone);
    const map = mapsHref(r.address, r.city, r.zip);
    const web = ensureProtocol(r.website);
    const noContact = !tel && !web;
    const flag = flagFor(r.notes, noContact);
    const flagAttr = flag ? `data-flag="${flag}"` : "";
    const isStatewide = r.county === "Statewide" || r.city === "Statewide";
    const meta = CATEGORY_META[r.bucket] || { tone: "blue" };

    const badges = [`<span class="badge" data-tone="${meta.tone}">${escapeHtml(catLabel(r.bucket || "Other"))}</span>`];
    if (isStatewide) {
      badges.push(`<span class="badge badge-statewide">${escapeHtml(t("statewideBadge"))}</span>`);
    }
    if (r.program && r.program !== r.bucket) {
      badges.push(`<span class="badge badge-prog">${escapeHtml(r.program)}</span>`);
    }

    const locParts = [r.address, r.city && r.city !== "Statewide" ? r.city : null, r.zip ? String(r.zip) : null].filter(Boolean);
    const loc = isStatewide && !r.address
      ? (currentLang === "es" ? "Disponible en los 100 condados de Carolina del Norte" : "Serves all 100 North Carolina counties")
      : (locParts.length ? escapeHtml(locParts.join(", ")) : escapeHtml(t("addrMissing")));

    const rowsHtml = [];
    if (r.schedule) {
      rowsHtml.push(`<div class="row"><span class="row-icon">${ICONS.clock}</span><span class="row-text">${escapeHtml(r.schedule)}</span></div>`);
    }
    if (r.eligibility) {
      rowsHtml.push(`<div class="row"><span class="row-icon">${ICONS.check}</span><span class="row-text"><strong>${escapeHtml(t("whoLabel"))}</strong> ${escapeHtml(r.eligibility)}</span></div>`);
    }
    if (r.documents && r.documents !== "None") {
      rowsHtml.push(`<div class="row"><span class="row-icon">${ICONS.doc}</span><span class="row-text"><strong>${escapeHtml(t("bringLabel"))}</strong> ${escapeHtml(r.documents)}</span></div>`);
    }
    if (r.apply) {
      rowsHtml.push(`<div class="row"><span class="row-icon">${ICONS.arrow}</span><span class="row-text"><strong>${escapeHtml(t("howLabel"))}</strong> ${escapeHtml(r.apply)}</span></div>`);
    }

    const ctas = [];
    if (tel) {
      ctas.push(`<a class="cta" href="${tel}" aria-label="${escapeHtml(t("callBtn"))} ${agencyEsc} ${escapeHtml(r.phone)}">${ICONS.phone}<span>${escapeHtml(t("callBtn"))} ${escapeHtml(r.phone)}</span></a>`);
    }
    if (noContact) {
      ctas.unshift(`<a class="cta" href="tel:211">${ICONS.phone}<span>${escapeHtml(t("call211Btn"))}</span></a>`);
    }
    if (map) {
      ctas.push(`<a class="cta alt" href="${map}" target="_blank" rel="noopener">${ICONS.pin}<span>${escapeHtml(t("directionsBtn"))}</span></a>`);
    }
    if (web) {
      ctas.push(`<a class="cta alt" href="${escapeHtml(web)}" target="_blank" rel="noopener">${ICONS.globe}<span>${escapeHtml(t("websiteBtn"))}</span></a>`);
    }
    ctas.push(`<button type="button" class="cta alt share-btn" data-share-id="${r.id}" aria-label="${escapeHtml(t("shareBtn"))} ${agencyEsc}">${ICONS.share}<span>${escapeHtml(t("shareBtn"))}</span></button>`);

    let notesText = r.notes || "";
    if (noContact) {
      const warning = t("noContactWarn");
      notesText = notesText ? `${warning} ${notesText}` : warning;
    }
    const notesHtml = notesText
      ? `<div class="notes"${noContact ? ' data-strong="true"' : ""}><strong>${escapeHtml(t("noteLabel"))}</strong> ${escapeHtml(notesText)}</div>`
      : "";

    const verified = r.last_verified
      ? `<div class="verified">${escapeHtml(t("lastChecked"))} <time datetime="${escapeHtml(r.last_verified)}">${escapeHtml(formatVerifiedDate(r.last_verified))}</time></div>`
      : "";

    return `
    <article class="card" ${flagAttr}>
      <header class="card-head">
        <div class="card-badges">${badges.join("")}</div>
        <h3 class="card-name">${agencyEsc}</h3>
        <div class="card-loc">${ICONS.pin}<span>${loc}</span></div>
      </header>
      ${rowsHtml.length ? `<div class="card-rows">${rowsHtml.join("")}</div>` : ""}
      <div class="cta-row">${ctas.join("")}</div>
      ${notesHtml}
      <div class="card-foot">
        <button class="expand-toggle" type="button" aria-expanded="false" data-row-id="${r.id}"><span>${escapeHtml(t("detailsOpen"))}</span>${ICONS.chevron}</button>
        ${verified}
      </div>
      <div class="detail">
        <p data-detail-for="${r.id}"><em>${escapeHtml(t("loadingShort"))}</em></p>
      </div>
    </article>`;
  }

  function updatePrintHeader(state, count) {
    if (!printHeaderEl) return;
    const parts = [];
    if (state.placeValue) parts.push(state.placeValue === "Statewide" ? "Statewide NC" : state.placeValue);
    if (state.bucket) parts.push(catLabel(state.bucket));
    if (state.search) parts.push(`"${state.search}"`);
    const today = new Date().toLocaleDateString(currentLang === "es" ? "es-US" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
    printHeaderEl.innerHTML = `
      <h2>NC Resources — ${escapeHtml(parts.join(" · ") || "North Carolina Directory")} (${count})</h2>
      <p>nc-resources.org · Printed ${escapeHtml(today)} · Please call agencies before visiting · 24/7 referrals: 2-1-1 · Crisis: 988 · Emergency: 911</p>`;
  }

  function render(state) {
    const rows = filterRows(state);

    if (rows === null) {
      homeDiscoveryEl.classList.remove("is-hidden");
      toolbarEl.classList.add("is-hidden");
      statewideSectionEl.classList.add("is-hidden");
      resultsEl.innerHTML = "";
      statewideListEl.innerHTML = "";
      statusEl.innerHTML = "";
      return;
    }

    homeDiscoveryEl.classList.add("is-hidden");
    toolbarEl.classList.remove("is-hidden");

    const statewideExtra = filterStatewideSupplement(state);

    const parts = [];
    if (state.placeValue) {
      const placeDisplay = state.placeValue === "Statewide" ? t("statewideChip") : state.placeValue;
      parts.push(`${t("inPlace")} <strong>${escapeHtml(placeDisplay)}</strong>`);
    } else if (state.bucket || state.search) {
      parts.push(state.placeType === "county" ? t("inAnyCounty") : t("acrossNC"));
    }
    if (state.bucket) parts.push(escapeHtml(catLabel(state.bucket)));
    if (state.search) parts.push(`${t("matching")} <strong>"${escapeHtml(state.search)}"</strong>`);

    const word = rows.length === 1 ? t("agencySingular") : t("agencyPlural");
    statusEl.innerHTML = `<span class="count">${rows.length.toLocaleString()}</span> ${word} ${parts.join(" · ")}`;
    updatePrintHeader(state, rows.length + statewideExtra.length);

    if (rows.length === 0) {
      resultsEl.innerHTML = `<div class="empty">
        <p><strong>${escapeHtml(t("noMatchesTitle"))}</strong></p>
        <p>${escapeHtml(t("noMatchesBody"))}</p>
        <p>${escapeHtml(t("noMatches211"))} <a href="tel:211"><strong>2-1-1</strong></a>.</p>
      </div>`;
    } else {
      resultsEl.innerHTML = rows.map(cardHTML).join("");
    }

    if (statewideExtra.length > 0 && (state.bucket || state.search || rows.length < 15)) {
      statewideSectionEl.classList.remove("is-hidden");
      if (statewideHeadingEl) {
        statewideHeadingEl.textContent = `${t("alsoStatewide")} (${statewideExtra.length})`;
      }
      statewideListEl.innerHTML = statewideExtra.map(cardHTML).join("");
    } else {
      statewideSectionEl.classList.add("is-hidden");
      statewideListEl.innerHTML = "";
    }
  }

  function handleCardActions(container) {
    if (!container) return;
    container.addEventListener("click", (e) => {
      // Expand details
      const toggle = e.target.closest(".expand-toggle");
      if (toggle) {
        const card = toggle.closest(".card");
        const detail = card && card.querySelector(".detail");
        if (!detail) return;

        const open = detail.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        const span = toggle.querySelector("span");
        if (span) span.textContent = open ? t("detailsHide") : t("detailsOpen");

        if (!open) return;
        const rowId = toggle.dataset.rowId;
        const para = detail.querySelector("p[data-detail-for]");
        if (!para || !rowId || para.dataset.loaded === "true") return;

        loadDetails().then((cache) => {
          const text = cache[rowId];
          if (text) {
            para.textContent = text;
          } else {
            detail.classList.add("is-hidden");
            toggle.classList.add("is-hidden");
          }
          para.dataset.loaded = "true";
        });
        return;
      }

      // Share / Copy listing
      const shareBtn = e.target.closest(".share-btn");
      if (shareBtn && dataset) {
        const id = Number(shareBtn.dataset.shareId);
        const row = dataset.rows.find((r) => r.id === id);
        if (!row) return;
        const lines = [formatAgencyName(row.agency)];
        if (row.program) lines.push(row.program);
        const addr = [row.address, row.city && row.city !== "Statewide" ? row.city : null, row.zip].filter(Boolean).join(", ");
        if (addr) lines.push(`Address: ${addr}`);
        if (row.phone) lines.push(`Phone: ${row.phone}`);
        if (row.schedule) lines.push(`Hours: ${row.schedule}`);
        if (row.website) lines.push(`Website: ${ensureProtocol(row.website) || row.website}`);
        lines.push("Found via https://nc-resources.org/ (please call before going)");
        const text = lines.join("\n");

        if (navigator.share) {
          navigator.share({ title: formatAgencyName(row.agency), text }).catch(() => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => showToast(t("copiedToast"))).catch(() => {});
        }
      }
    });
  }

  function applyState(state, push) {
    populateFacets(state);
    render(state);
    const newUrl = urlFromState(state);
    if (push) {
      history.pushState(state, "", newUrl);
    } else {
      history.replaceState(state, "", newUrl);
    }
    const titleParts = ["NC Resources"];
    if (state.placeValue) titleParts.push(state.placeValue);
    if (state.bucket) titleParts.push(catLabel(state.bucket));
    if (state.search) titleParts.push(`"${state.search}"`);
    document.title = titleParts.join(" · ") + " — Free help across North Carolina";
  }

  function clearAll() {
    placeValueEl.value = "";
    bucketEl.value = "";
    if (searchEl) searchEl.value = "";
    applyState(readState(), true);
  }

  function bindControls() {
    document.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextType = btn.dataset.placeType;
        if (!nextType || placeTypeEl.value === nextType) return;
        placeTypeEl.value = nextType;
        const s = readState();
        s.placeValue = "";
        applyState(s, true);
      });
    });

    placeValueEl.addEventListener("change", () => applyState(readState(), true));
    bucketEl.addEventListener("change", () => applyState(readState(), true));

    if (searchEl) {
      let searchTimer = null;
      searchEl.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => applyState(readState(), true), 180);
      });
    }

    clearBtn.addEventListener("click", clearAll);
    if (allCategoriesBtn) allCategoriesBtn.addEventListener("click", clearAll);
    if (printBtn) printBtn.addEventListener("click", () => window.print());

    if (quickPlaceChipsEl) {
      quickPlaceChipsEl.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-quick-place]");
        if (!chip) return;
        const target = chip.dataset.quickPlace;
        const s = readState();
        s.placeValue = s.placeValue === target ? "" : target;
        applyState(s, true);
      });
    }

    if (categoryGridEl) {
      categoryGridEl.addEventListener("click", (e) => {
        const card = e.target.closest(".cat-card");
        if (!card) return;
        const s = readState();
        s.bucket = card.dataset.bucket || "";
        applyState(s, true);
        toolbarEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (viewStatewideBtn) {
      viewStatewideBtn.addEventListener("click", () => {
        const s = readState();
        s.placeValue = "Statewide";
        s.bucket = "";
        applyState(s, true);
        toolbarEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.dataset.lang;
        if (!lang || lang === currentLang) return;
        currentLang = lang;
        applyTranslations();
        if (dataset && dataDateEl && dataset.generated_at) {
          dataDateEl.textContent = formatVerifiedDate(dataset.generated_at);
        }
        applyState(readState(), false);
      });
    });

    handleCardActions(resultsEl);
    handleCardActions(statewideListEl);

    window.addEventListener("popstate", (e) => {
      const s = e.state || stateFromUrl();
      currentLang = s.lang === "es" ? "es" : "en";
      applyTranslations();
      placeTypeEl.value = s.placeType || "city";
      placeValueEl.value = s.placeValue || "";
      bucketEl.value = s.bucket || "";
      if (searchEl) searchEl.value = s.search || "";
      applyState(s, false);
    });
  }

  function setLoading(loading) {
    [placeTypeEl, placeValueEl, bucketEl, clearBtn].forEach((el) => {
      if (!el) return;
      el.disabled = loading;
      el.setAttribute("aria-busy", loading ? "true" : "false");
    });
    document.querySelectorAll(".seg-btn").forEach((btn) => { btn.disabled = loading; });
    if (loading) {
      placeValueEl.innerHTML = `<option>${escapeHtml(t("loadingAgencies"))}</option>`;
      bucketEl.innerHTML = `<option>${escapeHtml(t("loadingShort"))}</option>`;
      document.body.classList.add("is-loading");
    } else {
      document.body.classList.remove("is-loading");
    }
  }

  function showFatalError(message) {
    homeDiscoveryEl.classList.add("is-hidden");
    toolbarEl.classList.add("is-hidden");
    resultsEl.innerHTML = `<div class="empty">
      <p><strong>The directory couldn't load.</strong> Please try refreshing the page.</p>
      <p>If the problem continues, dial <a href="tel:211"><strong>2-1-1</strong></a> for 24/7 community help referrals.</p>
      <p class="meta-error">Technical detail: ${escapeHtml(message)}</p>
    </div>`;
  }

  async function init() {
    const initial = stateFromUrl();
    currentLang = initial.lang === "es" ? "es" : "en";
    applyTranslations();
    setLoading(true);

    window.addEventListener("error", (e) => {
      console.error("Uncaught error:", e.error || e.message);
      if (!dataset) showFatalError(e.error?.message || e.message || "Unknown error");
    });
    window.addEventListener("unhandledrejection", (e) => {
      console.error("Unhandled rejection:", e.reason);
      if (!dataset) showFatalError(String(e.reason).slice(0, 120));
    });

    try {
      const res = await fetch("/data.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dataset = await res.json();
    } catch (err) {
      console.error("data.json fetch failed:", err);
      showFatalError(err.message || "Could not reach the directory file.");
      if (clearBtn) clearBtn.disabled = false;
      return;
    }

    if (dataDateEl && dataset.generated_at) {
      dataDateEl.textContent = formatVerifiedDate(dataset.generated_at);
    }
    if (statTotalEl && dataset.total) {
      statTotalEl.textContent = dataset.total.toLocaleString();
    }
    if (statBucketsEl && dataset.facets && dataset.facets.buckets) {
      statBucketsEl.textContent = String(dataset.facets.buckets.length);
    }

    setLoading(false);

    placeTypeEl.value = initial.placeType;
    if (searchEl && initial.search) searchEl.value = initial.search;
    bindControls();
    applyState(initial, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
