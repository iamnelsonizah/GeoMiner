'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Compass, 
  MapPin, 
  Layers, 
  Sparkles, 
  Activity, 
  Download, 
  GraduationCap, 
  CheckCircle2,
  BookOpen
} from 'lucide-react';

export interface TourGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleCaseStudy?: (districtKey: string) => void;
}

interface TourStep {
  title: string;
  badge: string;
  icon: React.ElementType;
  accentColor: string;
  summary: string;
  keyConcepts: { label: string; explanation: string }[];
  geologicalNote: string;
  practicalTip: string;
  actionText?: string;
  actionDistrict?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to GeoMiner",
    badge: "System Overview",
    icon: GraduationCap,
    accentColor: "#C8963E",
    summary: "GeoMiner is a cloud-based remote sensing and mineral prospectivity platform. It leverages Google Earth Engine to process multi-spectral satellite imagery (Sentinel-2 L2A) and digital elevation models (SRTM 30m) using genetic mineral deposit criteria to rank prospective exploration ground.",
    keyConcepts: [
      { label: "Surface Remote Sensing", explanation: "Analyzes the top millimeters of bare outcrop and float using optical, near-infrared (NIR), and shortwave-infrared (SWIR) reflectance." },
      { label: "Multi-Criteria Decision Making", explanation: "Uses Analytic Hierarchy Process (AHP) evidence weighting to score mineral systems targets rather than black-box guesses." },
      { label: "Exploration Funnel", explanation: "Designed for Stage 1 regional reconnaissance across 50 to 5,000 km² before deploying expensive field drilling." }
    ],
    geologicalNote: "Remote sensing guides ground verification (soil geochemistry, trenching, pXRF). It does not replace field geology or directly detect subsurface ore.",
    practicalTip: "Explore bare or semi-arid cordilleran belts (Andes, Great Basin, Pilbara, Central Asia) where rock exposure is high."
  },
  {
    title: "1. Defining Your Area of Interest (AOI)",
    badge: "Step 1: Ground Selection",
    icon: MapPin,
    accentColor: "#4E8C85",
    summary: "You are not limited to fixed districts. You can investigate prospective mineral belts anywhere on Earth using multiple flexible input methods.",
    keyConcepts: [
      { label: "Global Place Search", explanation: "Search any city, district, or geographic landmark globally via the search bar." },
      { label: "Coordinate Jump", explanation: "Input exact decimal coordinates (latitude, longitude) to navigate directly to an exploration license." },
      { label: "Custom Drawing Tools", explanation: "Use the floating toolbar to draw custom bounding rectangles or irregular exploration concession polygons." },
      { label: "Curated Benchmarks", explanation: "Quick-jump to world-class exploration districts like Escondida, Pilbara, Karaganda, and Witwatersrand." }
    ],
    geologicalNote: "AOIs are capped at 5,000 km² (~3° span) per run to guarantee real-time cloud satellite processing and high spatial fidelity.",
    practicalTip: "Try clicking one of the province bookmark pills (e.g. 'Escondida Cu-Mo') to immediately center on a classic porphyry system.",
    actionText: "Load Escondida Benchmark",
    actionDistrict: "escondida"
  },
  {
    title: "2. Deposit Models & AHP Weights",
    badge: "Step 2: Genetic Criteria",
    icon: Compass,
    accentColor: "#E07A5F",
    summary: "Different mineral systems have distinct geological fingerprints. Selecting the deposit model configures the underlying multi-criteria evidence weights.",
    keyConcepts: [
      { label: "Porphyry Cu-Au-Mo", explanation: "Prioritizes phyllic/argillic clay halos (SWIR absorption) and regional structural lineaments around subvolcanic intrusions." },
      { label: "Epithermal Gold (Au-Ag)", explanation: "Emphasizes advanced argillic alteration (alunite/kaolinite) and silicification in shallow volcanic settings." },
      { label: "Orogenic Gold", explanation: "Weights structural fault density and shear zones higher than surface alteration, reflecting deep crustal fluid conduits." },
      { label: "Sedex / VMS (Zn-Pb-Cu)", explanation: "Balances stratiform ferric iron gossans with syn-sedimentary fault intersections." },
      { label: "Lithium Pegmatite (LCT)", explanation: "Focuses on fractionated granitic contact margins and pegmatitic structural swarms." }
    ],
    geologicalNote: "Mineralization styles dictate your criteria. Never run an epithermal model over a regional shear-hosted orogenic gold terrain.",
    practicalTip: "You can adjust individual layer weights in the 'Criteria Weighting' panel to match your team's proprietary exploration thesis."
  },
  {
    title: "3. Spectral Alteration Indices",
    badge: "Step 3: Spaceborne Spectroscopy",
    icon: Layers,
    accentColor: "#9B5DE5",
    summary: "Sentinel-2's 13 spectral bands allow us to compute diagnostic reflectance band ratios that map specific hydrothermal alteration mineral families.",
    keyConcepts: [
      { label: "Hydroxyl / Clay Halos (SWIR1 / SWIR2)", explanation: "B11 / B12 ratio detects Al-OH and Fe-OH absorption in illite, kaolinite, and smectite clays characteristic of phyllic and argillic alteration." },
      { label: "Ferric Iron (Red / Green)", explanation: "B4 / B3 ratio maps oxidized iron minerals (hematite, goethite, jarosite) typically found in leached cappings." },
      { label: "Gossan Index", explanation: "Identifies supergene-weathered massive sulfide caps and ironstone ridges." },
      { label: "Vegetation Masking", explanation: "Automatically masks green canopy (NDVI > 0.35) so chlorophyll signatures don't create false alteration anomalies." }
    ],
    geologicalNote: "Band ratios highlight mineral absorption features independent of illumination variations. Alteration composites combine clay, ferric, and ferrous channels as RGB.",
    practicalTip: "Toggle individual layers on and off in the Layers panel on the right to examine spectral anomalies against true-color satellite imagery."
  },
  {
    title: "4. Structural Lineaments & Terrain",
    badge: "Step 4: Hydrothermal Conduits",
    icon: Activity,
    accentColor: "#F39C12",
    summary: "Hydrothermal mineral deposits require permeable pathways for fluid migration. GeoMiner extracts regional faults, shear zones, and structural intersections from elevation data.",
    keyConcepts: [
      { label: "SRTM 30m Digital Elevation Model", explanation: "Provides seamless topographic surface height across global landmasses." },
      { label: "Kernel Sobel Convolutions", explanation: "Detects sharp elevation gradients and directional discontinuities representing fault traces and fracture networks." },
      { label: "Lineament Density", explanation: "Calculates spatial density of fractures to flag dilatational jogs, fault intersections, and structural traps." },
      { label: "Slope Masking", explanation: "Filters out extreme sheer cliffs (>35°) where rockfall artifacts occur and flat valley alluvium (<5°) that conceals bedrock." }
    ],
    geologicalNote: "Major porphyry and epithermal camps globally concentrate at the intersection of regional crustal lineaments and secondary transfer faults.",
    practicalTip: "View the 'Structural Lineaments' layer with 'Hillshade' underneath to see fault orientations relative to mountain topography."
  },
  {
    title: "5. Prospectivity Engine & Pit Filter",
    badge: "Step 5: Target Generation",
    icon: Sparkles,
    accentColor: "#2ECC71",
    summary: "Clicking 'Run Prospectivity Targeting' executes the full multi-criteria synthesis on Google Earth Engine, ranking prospective areas from 0.00 to 1.00.",
    keyConcepts: [
      { label: "Ranking Score Threshold", explanation: "Set a threshold (e.g. 0.65 - 0.85) to define high-confidence follow-up areas. Higher scores filter down to the strongest anomalies." },
      { label: "Scores are NOT Probabilities", explanation: "A score of 0.82 means high spatial coincidence of alteration and structure, NOT an '82% chance of finding economic ore'." },
      { label: "Mine Disturbance Filter (Crucial!)", explanation: "Detects active open pits, haul roads, and tailings ponds so you don't flag an already-excavated mine as a 'new discovery'." },
      { label: "Scale Alert", explanation: "When zoomed beyond native 20m pixel resolution, boundaries reflect raster cells, not surveyed claim lines." }
    ],
    geologicalNote: "Excluding active mine disturbance saves exploration teams from recommending drill collars inside existing open pit benches.",
    practicalTip: "The 'Exclude Active Mine Disturbance' toggle is enabled by default to ensure realistic greenfield targets."
  },
  {
    title: "6. Target Review & GIS Export",
    badge: "Step 6: Field Verification",
    icon: Download,
    accentColor: "#3498DB",
    summary: "Once generated, ranked targets appear as interactive polygons on the map and ranked cards in the left panel, ready for professional GIS and field deployment.",
    keyConcepts: [
      { label: "Target Details Modal", explanation: "Click any target polygon or card to view centroid coordinates, area in hectares, and alteration intensity breakdown." },
      { label: "GeoJSON Export", explanation: "Download target polygons and heatmaps for direct drag-and-drop into QGIS, ArcGIS Pro, MapInfo, or Google Earth." },
      { label: "CSV Export", explanation: "Export tabular target coordinates, areas, and ranking metrics for import into mining packages (Micromine, Leapfrog, Surpac)." },
      { label: "Field Ground-Truthing", explanation: "Use exported coordinates to plan soil geochemistry grids, rock chip sampling, and ground geophysical traverses." }
    ],
    geologicalNote: "Always ground-truth targets with field geological mapping and portable XRF (pXRF) analysis before proposing diamond drill collars.",
    practicalTip: "You can click the 'Export GeoJSON' button at the bottom of the Target List to save your exploration targets in 1 click."
  }
];

export const TourGuideModal: React.FC<TourGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleCaseStudy
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('geominer_tour_dont_show');
      if (saved === 'true') {
        setDontShowAgain(true);
      }
    }
  }, []);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('geominer_tour_completed', 'true');
      if (dontShowAgain) {
        localStorage.setItem('geominer_tour_dont_show', 'true');
      }
    }
    onClose();
  };

  const handleActionClick = (districtKey?: string) => {
    if (districtKey && onSelectSampleCaseStudy) {
      onSelectSampleCaseStudy(districtKey);
    }
    handleNext();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#0F141C] border border-[#2A364F] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        {/* Top Progress Bar */}
        <div className="w-full bg-[#1A2232] h-1.5">
          <div 
            className="h-full bg-gradient-to-r from-[#C8963E] via-[#4E8C85] to-[#3498DB] transition-all duration-300 ease-out"
            style={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A364F] bg-[#141B26]">
          <div className="flex items-center space-x-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${currentStep.accentColor}20`, color: currentStep.accentColor }}
            >
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#1E2638] text-[#C8963E] border border-[#C8963E]/30 uppercase tracking-wider">
                  {currentStep.badge}
                </span>
                <span className="text-xs text-[#6B7A90]">
                  Step {currentStepIndex + 1} of {TOUR_STEPS.length}
                </span>
              </div>
              <h2 id="tour-title" className="text-lg font-bold text-white mt-0.5">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="p-1.5 text-[#6B7A90] hover:text-white rounded-lg hover:bg-[#1E2638] transition-colors"
            title="Close Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-[#AAB4C2]">
          {/* Summary */}
          <p className="text-white text-base leading-relaxed">
            {currentStep.summary}
          </p>

          {/* Key Concepts Grid */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#6B7A90] flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#C8963E]" />
              <span>Core Scientific Principles</span>
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {currentStep.keyConcepts.map((item, idx) => (
                <div key={idx} className="bg-[#141B26] border border-[#232D42] rounded-lg p-3 hover:border-[#354360] transition-colors">
                  <div className="font-semibold text-white flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8963E]" />
                    <span>{item.label}</span>
                  </div>
                  <div className="text-xs text-[#8F9CAE] mt-1 pl-3.5 leading-normal">
                    {item.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geological Note / Warning Box */}
          <div className="bg-[#1A2232] border-l-4 border-[#C8963E] p-3 rounded-r-lg text-xs leading-relaxed">
            <span className="font-bold text-[#C8963E] uppercase tracking-wider block mb-1">
              Geological Reality Check:
            </span>
            <span className="text-[#AAB4C2]">{currentStep.geologicalNote}</span>
          </div>

          {/* Practical Field Tip */}
          <div className="bg-[#132320] border border-[#1E4D40] p-3 rounded-lg text-xs text-[#52B788] flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#4E8C85]" />
            <div>
              <span className="font-semibold text-white">Field Tip: </span>
              {currentStep.practicalTip}
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2A364F] bg-[#141B26]">
          {/* Step indicator dots */}
          <div className="flex items-center space-x-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  idx === currentStepIndex 
                    ? 'w-6 bg-[#C8963E]' 
                    : idx < currentStepIndex 
                    ? 'w-2 bg-[#4E8C85]' 
                    : 'w-2 bg-[#2A364F] hover:bg-[#3E4E6B]'
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Optional Step Quick Action */}
            {currentStep.actionText && (
              <button
                onClick={() => handleActionClick(currentStep.actionDistrict)}
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded bg-[#1E2638] text-[#C8963E] border border-[#C8963E]/40 hover:bg-[#C8963E]/10 transition-colors font-medium mr-2"
              >
                <span>{currentStep.actionText}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#1E2638] text-white hover:bg-[#28344C] text-xs font-semibold border border-[#2A364F] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#C8963E] text-[#0A0D14] hover:bg-[#DBA84E] text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span>{isLastStep ? "Start Exploring" : "Next Step"}</span>
              {isLastStep ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bottom Status / Don't show again toggle */}
        <div className="px-6 py-2 bg-[#0C1017] border-t border-[#1F2738] flex items-center justify-between text-[11px] text-[#6B7A90]">
          <label className="flex items-center space-x-2 cursor-pointer hover:text-[#AAB4C2] select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => {
                setDontShowAgain(e.target.checked);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('geominer_tour_dont_show', e.target.checked ? 'true' : 'false');
                }
              }}
              className="rounded border-[#2A364F] bg-[#141B26] text-[#C8963E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
            />
            <span>Do not show tour on startup</span>
          </label>

          <span className="hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 rounded bg-[#1A2232] text-[#AAB4C2] border border-[#2A364F] text-[10px]">Esc</kbd> or click outside to dismiss
          </span>
        </div>
      </div>
    </div>
  );
};

export default TourGuideModal;
