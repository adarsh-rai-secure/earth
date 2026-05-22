# ESA Domain Reference — Phase I Environmental Site Assessments

Quick reference for environmental assessment terminology, report structure, and regulatory context. Use during the live build when domain-specific terms come up.

## What Is a Phase I ESA?

A Phase I Environmental Site Assessment is a standardized investigation of a property's environmental condition. Required for almost every commercial real estate transaction, refinancing, brownfield redevelopment, or federally funded project. The goal: identify Recognized Environmental Conditions (RECs) that indicate potential contamination.

Phase I ESAs are desk-based research. No soil sampling, no drilling. That's Phase II.

## The Federal Standard: ASTM E1527-21

ASTM International publishes the standard practice for Phase I ESAs. The 2021 revision (E1527-21) is current. The report must include specific sections in a specific order. Environmental professionals must follow this standard to provide liability protection under CERCLA (the Superfund law).

## State Regulatory Overlays

Different states add their own requirements on top of ASTM E1527-21:

| State | Agency | Key Standard |
|-------|--------|-------------|
| New Jersey | NJDEP | N.J.A.C. 7:26E (Preliminary Assessment) |
| Texas | TCEQ | Texas Risk Reduction Program |
| Florida | FDEP | Florida DEP Brownfields/Drycleaning |
| California | DTSC | Preliminary Endangerment Assessment |
| New York | NYSDEC | Part 375 Brownfield Cleanup Program |
| Pennsylvania | PA DEP | Act 2 Land Recycling Program |

## Finding Classifications

| Term | Abbreviation | Meaning |
|------|-------------|---------|
| Recognized Environmental Condition | REC | A condition that indicates an existing release, past release, or material threat of release of hazardous substances. Requires further investigation. |
| Historical Recognized Environmental Condition | HREC | A past release that has been addressed and meets regulatory closure criteria. No further action needed, but noted in the report. |
| Controlled Recognized Environmental Condition | CREC | A recognized environmental condition where contamination remains but is managed through institutional controls, engineering controls, or activity/use limitations. |
| De Minimis Condition | — | A condition that does not present a threat and is not a REC. Often noted but not classified. |
| Areas of Concern | AOC | Specific locations on or near the subject property that warrant attention. Listed in an AOC table with distances, directions, and rationale. |

## Standard Phase I ESA Report Sections

1. **Executive Summary** — High-level findings, REC/HREC/CREC classifications, recommendations
2. **Introduction** — Purpose, scope, limitations, special terms
3. **Site Description** — Address, legal description, current use, size, improvements
4. **User Provided Information** — Title records, environmental liens, AULs
5. **Records Review**
   - Federal and state regulatory database review (EDR/environmental database report)
   - Historical aerial photograph review (year-by-year)
   - Historical topographic map review
   - Sanborn fire insurance map review
   - City directory review (property occupancy over time)
   - Building department records
   - Prior environmental reports
6. **Physical Setting** — Geology, soils, hydrogeology, groundwater flow, flood zones
7. **Site Reconnaissance** — Physical inspection findings, observations
8. **Interviews** — Owner, occupant, local government officials
9. **AOC Tables** — Areas of Concern with findings per source
10. **Environmental Media Evaluation Table** — Soil, groundwater, soil vapor, surface water
11. **Findings and Conclusions** — REC/HREC/CREC determinations with supporting evidence
12. **Recommendations** — Suggested next steps (Phase II, no further action, monitoring)
13. **Certification** — Environmental professional's signature and qualifications

## Key Data Sources in an ESA

| Source | What It Contains | Format |
|--------|-----------------|--------|
| City Directories | Year-by-year business/resident occupancy by address | Scanned PDFs, often poor quality |
| Sanborn Maps | Fire insurance maps showing building footprints, uses, construction materials | Historical images/PDFs |
| Aerial Photographs | Year-by-year overhead photos showing development, land use changes | Images |
| Regulatory Databases | EPA, state agency records of registered tanks, contamination sites, permits | Structured exports or PDFs |
| Radius Maps | Map showing regulated sites within specific distances (1/8, 1/4, 1/2, 1 mile) | PDFs with tables |
| Topographic Maps | USGS topo maps showing terrain, water features, historical development | Images |
| Environmental Liens | Recorded liens from environmental cleanup obligations | Legal documents |
| Prior Environmental Reports | Previous Phase I, Phase II, remediation reports for the property | PDFs |

## Regulatory Database Acronyms (Common)

| Acronym | Full Name |
|---------|-----------|
| UST | Underground Storage Tank |
| LUST / LPST | Leaking Underground Storage Tank / Leaking Petroleum Storage Tank |
| RCRA | Resource Conservation and Recovery Act (hazardous waste) |
| CERCLIS / SEMS | Comprehensive Environmental Response, Compensation, and Liability Information System |
| NPL | National Priorities List (Superfund sites) |
| CORRACTS | RCRA Corrective Action facilities |
| VCP | Voluntary Cleanup Program |
| ERNS | Emergency Response Notification System |
| SWF/LF | Solid Waste Facilities / Landfills |
| FINDS | Facility Index System |
| HIST AUTO | Historical Auto Station (gas stations, repair shops) |
| PST | Petroleum Storage Tank |
| SHWS | State Hazardous Waste Sites |
| IC/EC | Institutional Controls / Engineering Controls |

## AMA Earth's Specific Pipeline

Based on their product and sample outputs:

1. **Document ingestion:** Consultant uploads PDFs (city directories, radius maps, Sanborn maps, aerial photos, regulatory exports). Up to 100 files per project.
2. **OCR + text extraction:** Scanned docs get OCR'd. Structured data gets parsed.
3. **Entity extraction:** Addresses, facility names, owner/operator records, tank IDs, release case numbers, dates, distances, directions.
4. **Cross-document correlation:** A finding in a city directory (e.g., "Susino Garage at 179 Oliver Street, 1932-1962") gets matched with regulatory database records (e.g., "NJDEP UST Facility ID 008385, five tanks installed 1944-1977") to determine REC status.
5. **Finding classification:** Each AOC gets classified as REC, HREC, CREC, or de minimis based on ASTM criteria + state rules.
6. **Report generation:** Sections assembled in ASTM order. Citations link back to source documents.
7. **Human review:** Environmental consultant reviews, edits, signs off.

## Quick Vocabulary for Conversation

- "AOC" = Area of Concern (not the congresswoman)
- "EDR" = Environmental Data Resources (the dominant database vendor)
- "EP" = Environmental Professional (the qualified person who signs the report)
- "AUL" = Activity and Use Limitation (deed restriction on contaminated property)
- "CERCLA" = Superfund law. Phase I ESAs provide liability protection under it.
- "AAI" = All Appropriate Inquiries (the federal rule that Phase I ESAs satisfy)
- "Brownfield" = Property where reuse is complicated by real or perceived contamination
