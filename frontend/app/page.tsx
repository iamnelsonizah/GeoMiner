'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Crosshair, 
  Layers, 
  Activity, 
  ExternalLink,
  Menu,
  X,
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function GeoMinerLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0F12] text-white selection:bg-[#B7E89F] selection:text-[#0B0F12] font-sans relative overflow-x-hidden antialiased">
      
      {/* ────────────────────────────────── Top Navigation Bar ────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F12]/95 backdrop-blur-md border-b border-[#1D262F]">
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <svg className="w-5 h-5 text-[#B7E89F]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13H4.5L12 5.8z"/>
              </svg>
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-white">
                GeoMiner
              </span>
            </Link>
            <span className="hidden sm:inline-block text-[#2E3C4D]">|</span>
            <span className="hidden sm:inline-block font-mono text-[10.5px] text-[#9EABB8] tracking-[0.14em] uppercase">
              EARTH OBSERVATION
            </span>
          </div>

          {/* Navigation Links — Clean Title Case */}
          <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-medium text-[#C2CCD6]" aria-label="Main Navigation">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
            <a href="#models" className="hover:text-white transition-colors">Deposit models</a>
            <a href="#tools" className="hover:text-white transition-colors">Tools</a>
            <a href="#deliverables" className="hover:text-white transition-colors">Exports &amp; API</a>
          </nav>

          {/* Right Actions: Log in / User Profile & Launch Workspace */}
          <div className="flex items-center gap-4 shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <span className="hidden lg:inline-block text-xs font-mono text-[#9EABB8] bg-[#10161C] border border-[#1E2735] px-2.5 py-1 rounded">
                  {user.fullName || user.email}
                </span>
                <Link 
                  href="/app" 
                  className="bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-medium text-[13.5px] px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="text-[#9EABB8] hover:text-white p-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-[13.5px] font-medium text-[#C2CCD6] hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link 
                  href="/app" 
                  className="bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-medium text-[13.5px] px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <span>Launch Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}

            {/* Mobile Menu trigger */}
            <button 
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center p-1.5 text-[#9EABB8] hover:text-white"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#1D262F] bg-[#0B0F12] px-6 py-4 space-y-3 text-[14px]">
            <a href="#platform" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Platform</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Workflow</a>
            <a href="#models" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Deposit models</a>
            <a href="#tools" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Tools</a>
            <a href="#deliverables" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Exports &amp; API</a>
            {isAuthenticated ? (
              <div className="pt-2 border-t border-[#1D262F] flex items-center justify-between">
                <Link href="/app" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#B7E89F] font-semibold">Open Workspace →</Link>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="text-xs text-[#EF4444]">Sign out</button>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#1D262F] space-y-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#C2CCD6] hover:text-white">Log in</Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-[#B7E89F] font-semibold">Register Account →</Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main>

        {/* ────────────────────────────────── Hero Section: Side-by-Side ────────────────────────────────── */}
        <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 border-b border-[#1D262F] overflow-hidden bg-[#0B0F12]">
          <div className="max-w-[1240px] mx-auto px-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              
              {/* Left Column: Headline, Copy & CTAs */}
              <div className="lg:col-span-5 space-y-5">
                
                <div className="text-[#B7E89F] font-mono text-[10.5px] tracking-[0.16em] font-semibold uppercase">
                  SATELLITE ANALYTICS FOR MINERAL EXPLORATION
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-normal leading-[1.08] tracking-[-0.03em] text-white">
                  Mineral exploration,<br />
                  without the GIS<br />
                  overhead.
                </h1>

                <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#9EABB8] max-w-lg">
                  GeoMiner turns Earth observation data into mineral prospectivity targets and alteration maps you can actually use. Define a concession, select your deposit model, generate ranked targets. No complex setup, no GIS software.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link 
                    href="/app" 
                    className="bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-medium text-[14px] px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-sm"
                  >
                    <span>Start targeting free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a 
                    href="#workflow" 
                    className="text-[14px] font-medium text-white hover:text-[#B7E89F] px-4 py-2.5 transition-colors"
                  >
                    See how it works
                  </a>
                </div>

              </div>

              {/* Right Column: Authentic Live GeoMiner Screenshot */}
              <div className="lg:col-span-7">
                <div className="rounded-xl overflow-hidden border border-[#1D262F] shadow-2xl bg-[#10161C]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/geominer-hero-mockup.png" 
                    alt="GeoMiner Workstation — Mineral Exploration & Remote Sensing Analysis" 
                    className="w-full h-auto object-cover block"
                  />
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ────────────────────────────────── Section: How It Works ────────────────────────────────── */}
        <section id="workflow" className="py-24 bg-[#0B0F12]">
          <div className="max-w-[1240px] mx-auto px-6">
            
            {/* Section Tag */}
            <div className="text-[#B7E89F] font-mono text-[11px] font-semibold tracking-[0.22em] uppercase mb-12">
              H O W &nbsp; I T &nbsp; W O R K S
            </div>

            {/* 4-Step Sequence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* Step 01 */}
              <div className="space-y-2.5">
                <div className="font-mono text-sm font-medium text-[#B7E89F]">01</div>
                <h3 className="text-lg font-semibold text-white tracking-[-0.01em]">
                  Define study area
                </h3>
                <p className="text-[14px] text-[#9EABB8] leading-relaxed">
                  Draw or upload your boundary. Delineate regional exploration blocks up to 2,500 km².
                </p>
              </div>

              {/* Step 02 */}
              <div className="space-y-2.5">
                <div className="font-mono text-sm font-medium text-[#B7E89F]">02</div>
                <h3 className="text-lg font-semibold text-white tracking-[-0.01em]">
                  Choose deposit model
                </h3>
                <p className="text-[14px] text-[#9EABB8] leading-relaxed">
                  Select Porphyry Cu-Au, Epithermal Au, Lithium (LCT), Iron Gossan, or VMS Base Metals presets.
                </p>
              </div>

              {/* Step 03 */}
              <div className="space-y-2.5">
                <div className="font-mono text-sm font-medium text-[#B7E89F]">03</div>
                <h3 className="text-lg font-semibold text-white tracking-[-0.01em]">
                  Run targeting
                </h3>
                <p className="text-[14px] text-[#9EABB8] leading-relaxed">
                  Our spectral and structural models process your data on Google Earth Engine in seconds. No coding.
                </p>
              </div>

              {/* Step 04 */}
              <div className="space-y-2.5">
                <div className="font-mono text-sm font-medium text-[#B7E89F]">04</div>
                <h3 className="text-lg font-semibold text-white tracking-[-0.01em]">
                  Get ranked targets
                </h3>
                <p className="text-[14px] text-[#9EABB8] leading-relaxed">
                  View your prospectivity map, inspect ranked polygons (Tier 1–3), and export to Leapfrog Geo.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ────────────────────────────────── Section: Built For Real-World Exploration ────────────────────────────────── */}
        <section id="models" className="py-24 bg-[#0B0F12] border-t border-[#1D262F]">
          <div className="max-w-[1240px] mx-auto px-6">
            
            <div className="space-y-3 mb-12">
              <span className="text-[#B7E89F] font-mono text-[11px] font-semibold tracking-wider uppercase">
                BUILT FOR REAL-WORLD EXPLORATION
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-normal tracking-[-0.025em] text-white">
                From regional screening to drill targets
              </h2>
              <p className="text-[16px] text-[#9EABB8] max-w-2xl leading-relaxed">
                Whether screening Andean copper belts, Western Australian lithium pegmatites, or VMS shear corridors, GeoMiner delivers verifiable remote-sensing proof.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Left Column: Workstation View Card */}
              <div className="lg:col-span-7 bg-[#10161C] border border-[#1E2735] rounded-xl p-6 sm:p-7 flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wider uppercase">
                      WORKSTATION VIEW
                    </span>
                    <Link 
                      href="/app" 
                      className="text-xs text-[#B7E89F] hover:underline inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Open Live Engine</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Unified Remote Sensing Command Center
                  </h3>
                </div>

                <div className="rounded-lg overflow-hidden border border-[#1E2735] bg-[#0B0F12]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/geominer-hero-mockup.png" 
                    alt="GeoMiner Command Center View" 
                    className="w-full h-auto object-cover block"
                  />
                </div>

                <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                  Interactive multi-temporal AOI delineation over Escondida Cu-Au with 12 layered spectral products, deposit-model AHP consensus, and instant target footprint telemetry.
                </p>
              </div>

              {/* Right Column: 3 Stacked Capability Cards */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                
                {/* Card 1: Spectral Alteration Engine */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-2 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm bg-[#B7E89F] inline-block shrink-0"></span>
                    <span className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide uppercase">
                      SPECTRAL ALTERATION ENGINE
                    </span>
                  </div>
                  <h4 className="text-[17px] font-semibold text-white">
                    Hydroxyl (Al-OH) &amp; Gossan Diagnostics
                  </h4>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Diagnostic SWIR1/SWIR2 (B11/B12) and Red/Green (B4/B3) ratios mapping phyllic sericite halos, advanced argillic alteration, and supergene iron oxide gossans.
                  </p>
                  <div className="pt-2 border-t border-[#1E2735] font-mono text-[11px] flex justify-between text-[#9EABB8]">
                    <span>Sensors: Sentinel-2 (VNIR/SWIR)</span>
                    <span className="text-[#B7E89F] font-medium">Active</span>
                  </div>
                </div>

                {/* Card 2: Structural Geophysics */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-2 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm bg-[#B7E89F] inline-block shrink-0"></span>
                    <span className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide uppercase">
                      STRUCTURAL GEOPHYSICS
                    </span>
                  </div>
                  <h4 className="text-[17px] font-semibold text-white">
                    Multidirectional Hillshade &amp; Lineaments
                  </h4>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Blends 0°, 45°, 90°, and 135° illumination azimuths with Sobel spatial filters to reveal shear fault corridors, structural dilatation zones, and fracture intersections.
                  </p>
                  <div className="pt-2 border-t border-[#1E2735] font-mono text-[11px] flex justify-between text-[#9EABB8]">
                    <span>Resolution: Copernicus 30m DEM</span>
                    <span className="text-[#B7E89F] font-medium">Active</span>
                  </div>
                </div>

                {/* Card 3: AHP Targeting Consensus */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-2 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm bg-[#B7E89F] inline-block shrink-0"></span>
                    <span className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide uppercase">
                      AHP TARGETING CONSENSUS
                    </span>
                  </div>
                  <h4 className="text-[17px] font-semibold text-white">
                    Multi-Criteria Target Ranking Engine
                  </h4>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Analytic Hierarchy Process (AHP) synthesizing alteration, structure, gossan, and terrain into auditable 0–100 ranking scores with automated bare-rock NDVI screening.
                  </p>
                  <div className="pt-2 border-t border-[#1E2735] font-mono text-[11px] flex justify-between text-[#9EABB8]">
                    <span>Output: Ranked Vector Polygons</span>
                    <span className="text-[#B7E89F] font-medium">Ready</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ────────────────────────────────── Section: Layer Registry ────────────────────────────────── */}
        <section id="platform" className="py-24 bg-[#0B0F12] border-t border-[#1D262F]">
          <div className="max-w-[1240px] mx-auto px-6">
            
            <div className="space-y-3 mb-12">
              <span className="text-[#B7E89F] font-mono text-[11px] font-semibold tracking-wider uppercase">
                LAYER REGISTRY
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-normal tracking-[-0.025em] text-white">
                Authentic exploration layers ready on click
              </h2>
              <p className="text-[16px] text-[#9EABB8] max-w-2xl leading-relaxed">
                Explore the exact earth observation layers computed on Google Earth Engine supercomputing clusters inside GeoMiner.
              </p>
            </div>

            {/* 12 Exploration Layer Cards in 6 Columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {[
                { name: 'Hydroxyl (Al-OH)', img: '/layer-thumbnails/false_color.png', spec: 'Sentinel-2 (B11/B12)' },
                { name: 'Ferric Iron (Fe³⁺)', img: '/layer-thumbnails/burn_ratio.png', spec: 'Sentinel-2 (B4/B3)' },
                { name: 'Ferrous Iron (Fe²⁺)', img: '/layer-thumbnails/vegetation.png', spec: 'B11/B8 + B3/B4' },
                { name: 'Gossan Diagnostic', img: '/layer-thumbnails/built_up.png', spec: 'Sentinel-2 (B11/B4)' },
                { name: 'Alteration RGB', img: '/layer-thumbnails/land_cover.png', spec: 'Synthesis False Color' },
                { name: 'Mine Disturbance', img: '/layer-thumbnails/water.png', spec: 'Sentinel-2 / SAR Mask' },
                { name: 'SAR Radar C-Band', img: '/layer-thumbnails/sar_radar.png', spec: 'Sentinel-1 GRD Roughness' },
                { name: 'Digital Elevation', img: '/layer-thumbnails/digital_elevation.png', spec: 'Copernicus 30m DEM' },
                { name: 'Slope Gradient', img: '/layer-thumbnails/slope_stability.png', spec: 'Geotechnical Degrees' },
                { name: 'Terrain Hillshade', img: '/layer-thumbnails/terrain_hillshade.png', spec: '4-Azimuth Topo Fusion' },
                { name: 'Lineament Density', img: '/layer-thumbnails/header_icon.png', spec: 'Sobel Fracture Corridors' },
                { name: 'True Color RGB', img: '/layer-thumbnails/true_color.png', spec: 'Sentinel-2 MSI (10m)' },
              ].map((layer, idx) => (
                <div 
                  key={idx}
                  className="bg-[#10161C] border border-[#1E2735] rounded-xl p-3 hover:border-[#B7E89F]/60 transition-colors flex flex-col justify-between group"
                >
                  <div className="aspect-video w-full rounded-lg overflow-hidden mb-2.5 bg-[#0C1014] border border-[#1D262F]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={layer.img} 
                      alt={layer.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-medium text-white tracking-[-0.01em]">
                      {layer.name}
                    </div>
                    <div className="text-[11.5px] text-[#9EABB8] mt-0.5 font-normal">
                      {layer.spec}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ────────────────────────────────── Section: Diagnostic Tools ────────────────────────────────── */}
        <section id="tools" className="py-24 bg-[#0B0F12] border-t border-[#1D262F]">
          <div className="max-w-[1240px] mx-auto px-6">
            
            <div className="space-y-3 mb-12">
              <span className="text-[#B7E89F] font-mono text-[11px] font-semibold tracking-wider uppercase">
                DIAGNOSTIC TOOLS
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-normal tracking-[-0.025em] text-white">
                Inspect pixels, curves, and time series
              </h2>
              <p className="text-[16px] text-[#9EABB8] max-w-2xl leading-relaxed">
                GeoMiner is engineered for exploration geologists who need to verify ground truth with physics-based diagnostics before publishing conclusions or planning drilling.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Left Column: 3 Diagnostic Cards */}
              <div className="lg:col-span-6 space-y-4">
                
                {/* 10-Band */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-1.5 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide">
                    10-BAND
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Full Spectral Signature Graph
                  </h3>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Click any pixel on Earth to graph its exact 10-band surface reflectance profile from coastal blue to SWIR-2. Differentiate phyllic sericite from unaltered host rock.
                  </p>
                </div>

                {/* 5-Year */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-1.5 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide">
                    5-YEAR
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Pixel Trajectory &amp; LandTrendr
                  </h3>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Segment multi-year Sentinel-2 medians from 2018 to 2025 to separate permanent open-pit mine excavations from seasonal vegetation phenology.
                  </p>
                </div>

                {/* Swipe */}
                <div className="bg-[#10161C] border border-[#1E2735] rounded-xl p-5 space-y-1.5 hover:border-[#B7E89F]/50 transition-colors">
                  <div className="font-mono text-[11px] font-semibold text-[#B7E89F] tracking-wide">
                    SWIPE
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Split-Screen Comparison Curtain
                  </h3>
                  <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
                    Drag an interactive vertical curtain to immediately detect spatial relationships between optical satellite feeds and hydrothermal alteration masks.
                  </p>
                </div>

              </div>

              {/* Right Column: Export Suite Card */}
              <div className="lg:col-span-6 bg-[#10161C] border border-[#1E2735] rounded-xl p-8 flex flex-col justify-between space-y-6" id="deliverables">
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#9EABB8]">
                    <span className="text-[#B7E89F] font-semibold uppercase tracking-wide">EXPORT SUITE</span>
                    <span>FIELD &amp; GIS READY</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-white">
                    Every result exports in publication formats
                  </h3>
                  <p className="text-[14.5px] text-[#9EABB8] leading-relaxed">
                    Take classified alteration layers and ranked vector targets directly into QGIS, ArcGIS, Google Earth, or Leapfrog Geo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[13px]">
                  <div className="bg-[#0B0F12] border border-[#1E2735] p-3 rounded-lg flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#B7E89F]"></span>
                    <span className="text-white text-[12.5px]">GeoTIFF (32-bit Float)</span>
                  </div>
                  <div className="bg-[#0B0F12] border border-[#1E2735] p-3 rounded-lg flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#B7E89F]"></span>
                    <span className="text-white text-[12.5px]">GeoJSON Vector Targets</span>
                  </div>
                  <div className="bg-[#0B0F12] border border-[#1E2735] p-3 rounded-lg flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#B7E89F]"></span>
                    <span className="text-white text-[12.5px]">CSV Summary &amp; Leapfrog</span>
                  </div>
                  <div className="bg-[#0B0F12] border border-[#1E2735] p-3 rounded-lg flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#B7E89F]"></span>
                    <span className="text-white text-[12.5px]">3D DXF (CAD) Targets</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ────────────────────────────────── Section: Terminal Launch CTA ────────────────────────────────── */}
        <section className="py-24 bg-[#0B0F12] border-t border-[#1D262F] text-center">
          <div className="max-w-2xl mx-auto px-6 space-y-6">
            
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-normal text-white tracking-[-0.025em]">
              Start your first targeting survey.
            </h2>

            <p className="text-[16px] text-[#9EABB8] max-w-xl mx-auto leading-relaxed">
              Launch the workspace, pick any concession on Earth, and receive instant mineral prospectivity intelligence and ranked exploration targets.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link 
                href="/app" 
                className="bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-medium text-[14px] px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-sm"
              >
                <span>Launch Workspace Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              {isAuthenticated ? (
                <button 
                  onClick={logout}
                  className="bg-[#182028] hover:bg-[#202B36] text-white border border-[#2E3C4D] font-medium text-[14px] px-5 py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  <span>Sign out</span>
                </button>
              ) : (
                <Link 
                  href="/login" 
                  className="bg-[#182028] hover:bg-[#202B36] text-white border border-[#2E3C4D] font-medium text-[14px] px-5 py-2.5 rounded-lg transition-all"
                >
                  <span>Sign in</span>
                </Link>
              )}
            </div>

          </div>
        </section>

      </main>

      {/* ────────────────────────────────── Footer ────────────────────────────────── */}
      <footer className="border-t border-[#1D262F] bg-[#0B0F12] py-12">
        <div className="max-w-[1240px] mx-auto px-6">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-[13px] text-[#9EABB8]">
            
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#B7E89F]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13H4.5L12 5.8z"/>
                </svg>
                <span className="font-semibold text-white">GeoMiner</span>
              </div>
              <span className="text-[#2E3C4D]">·</span>
              <span>© 2026 GeoMiner Geospatial Systems.</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6">
              <a href="#platform" className="hover:text-white transition-colors">Platform</a>
              <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
              <a href="#models" className="hover:text-white transition-colors">Deposit models</a>
              <a href="#tools" className="hover:text-white transition-colors">Tools</a>
              <a href="#deliverables" className="hover:text-white transition-colors">Exports &amp; API</a>
              {isAuthenticated ? (
                <button onClick={logout} className="hover:text-white transition-colors cursor-pointer">Sign out</button>
              ) : (
                <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              )}
            </div>

            {/* Sensor baseline */}
            <div className="text-[12px] text-[#606F7B] font-mono hidden lg:block">
              Sentinel-2 MSI (VNIR/SWIR) · Sentinel-1 SAR · Copernicus 30m DEM
            </div>

          </div>

        </div>
      </footer>

    </div>
  );
}
