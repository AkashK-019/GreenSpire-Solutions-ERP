export const APPOINTMENT_TEMPLATES = {
  'Landscape Consultancy': {
    title: 'Landscape Planning & Plantation Agreement',
    terms: [
      'Scope includes planting layout, hardscape concepts, lighting, water feature design, and irrigation plan.',
      'Procurement of plants, soil testing, and manual labor charges are separate from consultancy fees.',
      'The Consultant is not responsible for weather-related vegetation loss or water-source failure post-handover.'
    ],
    schedule: [
      { milestone: 'Initiation Fee', percent: 20 },
      { milestone: 'Landscape Concept & Hardscape Design', percent: 30 },
      { milestone: 'Plantation Schedule & Irrigation Drawing', percent: 30 },
      { milestone: 'Plant Delivery & Positioning Sign-off', percent: 20 }
    ]
  },
  'Plantation & Turf Work': {
    title: 'Horticulture Plantation & Lawn Turf Installation Contract',
    terms: [
      'The Contractor shall prepare soil, supply certified plant species, and execute lawn turf laying as per drawings.',
      'All soil additives, organic manures, and slow-release fertilizers are included in the billing scope.',
      'Any replacement of plants dying due to transit shocks is covered within 30 days from planting date.',
      'Client to ensure continuous water supply during the turf establishment phase (approx. 14 days).'
    ],
    schedule: [
      { milestone: 'Booking & Plant Sourcing Advance', percent: 40 },
      { milestone: 'Soil Conditioning & Levelling Completion', percent: 20 },
      { milestone: 'Tree and Shrub Planting Stage', percent: 20 },
      { milestone: 'Turf Laying & Final Handover Inspection', percent: 20 }
    ]
  },
  'Irrigation & Drainage Setup': {
    title: 'Automatic Drip & Sprinkler Irrigation Installation Agreement',
    terms: [
      'Scope covers main piping, solenoid valves, drip lines, sprinkler heads, pump connection, and controller setup.',
      'All pipeline pressure testing must be witnessed and signed off by the site engineer prior to backfilling.',
      'The controller warranty is restricted to manufacturer defects. Physical or electrical surge damages are excluded.'
    ],
    schedule: [
      { milestone: 'Signing Retainer', percent: 30 },
      { milestone: 'Mainline Pipeline & Trenches Sign-off', percent: 30 },
      { milestone: 'Sprinkler, Emitter, & Valve Installation', percent: 25 },
      { milestone: 'Commissioning & Controller Calibration', percent: 15 }
    ]
  },
  'Site Supervision & Care': {
    title: 'Weekly Landscaping Supervision & Horticulture Care Contract',
    terms: [
      'The supervisor will monitor vegetation health, irrigation cycles, pruning standards, and weed control.',
      'Supervisor will submit weekly site logs, weather impact warnings, and soil/moisture health summaries.',
      'This agreement is valid on a recurring monthly retainer fee basis.'
    ],
    schedule: [
      { milestone: 'Monthly Retainer Basis', percent: 100 }
    ]
  }
};

export const QUOTATION_TEMPLATES = {
  'Landscape Consultancy': {
    scope: 'Landscape zoning, pathways, hardscape drawings, lighting points, water features details, soil enhancement specs, and plant sourcing mapping.',
    fees: 95000,
    visitCharges: 3000,
    consultancyCharges: 20000,
    paymentTerms: '30% advance. 50% on presentation layouts. 20% on final plantation mapping.'
  },
  'Plantation & Lawn Setup': {
    scope: 'Procurement and planting of trees, shrubs, turf, decorative flora, setup of automatic sprinkler/drip irrigation system, and soil preparation.',
    fees: 350000,
    visitCharges: 0,
    consultancyCharges: 25000,
    paymentTerms: '50% advance for plant purchase. 30% on site preparation and planting. 20% on commissioning of system.'
  },
  'Irrigation & Drainage System': {
    scope: 'Supply and installation of UPVC main pipelines, sub-mains, lateral drip tubes, sprinkler headers, automatic timers, solenoid valves, and filter manifolds.',
    fees: 160000,
    visitCharges: 2500,
    consultancyCharges: 15000,
    paymentTerms: '40% advance for material purchase. 40% on layout piping. 20% on testing and controller setup.'
  },
  'Hardscape & Outdoor Structures': {
    scope: 'Construction of natural stone pathways, brick patios, decorative stone borders, custom wooden pergolas, gazebo setup, and masonry retaining walls.',
    fees: 680000,
    visitCharges: 0,
    consultancyCharges: 60000,
    paymentTerms: '40% advance for materials. 40% during masonry and structural work. 20% on finishing and cleanup.'
  },
  'Horticulture Maintenance': {
    scope: 'Scheduled lawn mowing, shrub pruning, weed control, fertilizer application, pest management checks, and weekly irrigation cycle adjustments.',
    fees: 25000,
    visitCharges: 1200,
    consultancyCharges: 5000,
    paymentTerms: 'Monthly recurring payment, invoiced on the 1st of every month.'
  }
};
