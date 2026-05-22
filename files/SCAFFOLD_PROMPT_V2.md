# Updated Scaffold Prompt — Parcel Boundary Automation

## Replace the old CLAUDE.md with CLAUDE_v2.md (rename it to CLAUDE.md)

Then paste this into your main Claude Code builder instance:

---

**PASTE START ↓**

Read CLAUDE.md for full project context. This project automates parcel boundary overlays on aerial photograph PDFs. The pipeline: user enters an address, we query Regrid for the parcel boundary GeoJSON, user uploads aerial PDFs, we render each page as an image, display the boundary on a map, and overlay it on the aerial photos.

**Step 1: Install additional dependencies**

```bash
npm install sharp pdf-lib leaflet react-leaflet @types/leaflet
npm install -D @types/sharp
```

Note: If `sharp` fails to install on Windows, try `npm install --platform=win32 sharp`. If pdf-to-image conversion is needed, we'll use pdf-lib to extract pages and a canvas approach, or fall back to an external service.

Commit: "deps: add sharp, pdf-lib, leaflet for parcel boundary pipeline"

**Step 2: Create the Regrid API wrapper**

Create `src/lib/regrid.ts`:
- Export `getParcelByAddress(address: string)` that calls:
  `https://app.regrid.com/api/v2/parcels/address?query=${encodeURIComponent(address)}&token=${process.env.REGRID_API_TOKEN}`
- Export `getParcelByPoint(lat: number, lng: number)` that calls:
  `https://app.regrid.com/api/v2/parcels/point?lat=${lat}&lon=${lng}&token=${process.env.REGRID_API_TOKEN}`
- Both return the GeoJSON FeatureCollection from the response
- Extract and return: the parcel boundary polygon (geometry), the address, the parcel number, the acreage
- Handle errors: API key missing, no results found, network errors

**Step 3: Create the geocoding utility**

Create `src/lib/geocode.ts`:
- Export `geocodeAddress(address: string): Promise<{ lat: number, lng: number }>` 
- Use the free Nominatim API: `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
- Return the lat/lng from the first result
- Add a User-Agent header (required by Nominatim)
- Handle: no results, network errors

**Step 4: Create API routes**

Create `src/app/api/regrid/route.ts`:
- POST handler accepts `{ address: string }` or `{ lat: number, lng: number }`
- If address provided, geocode it first, then query Regrid
- If lat/lng provided, query Regrid directly
- Return: `{ parcel: GeoJSON Feature, coordinates: { lat, lng }, address: string }`

Create `src/app/api/upload/route.ts`:
- POST handler accepts FormData with a PDF file
- Upload to Supabase storage bucket `uploads`
- Create a project record in the `projects` table
- Return: `{ projectId, fileUrl }`

Create `src/app/api/render-pages/route.ts`:
- POST handler accepts `{ projectId: string, fileUrl: string }`
- Download the PDF from Supabase storage
- Use pdf-lib to get page count
- For each page: render to PNG image (use a server-side approach)
- Upload each page image to Supabase storage
- Create aerial_pages records
- Return: `{ pages: [{ pageNumber, imageUrl }] }`

Note on PDF to image: This is the trickiest part on a serverless environment. Options:
1. Use `pdf-to-img` (requires canvas/node-canvas)
2. Use `@napi-rs/canvas` with pdf.js
3. Fall back: display the PDF directly in the browser using an iframe or react-pdf, and only process the overlay on the map side

If PDF-to-image is too complex for the time window, skip it and focus on:
- Displaying the uploaded PDF in the browser (react-pdf or iframe)
- Showing the parcel boundary on an interactive Leaflet map next to it
- That alone is valuable and demo-able

**Step 5: Build the UI**

Dark professional theme. Navy background (#0f172a), white text, green accents (#22c55e).

Create `src/app/components/AddressInput.tsx`:
- Text input for property address
- "Look Up Parcel" button
- On submit: calls /api/regrid, displays result
- Shows: found address, parcel number, acreage
- Loading state while querying

Create `src/app/components/ParcelMap.tsx`:
- Leaflet map component (use 'use client')
- Accepts GeoJSON polygon as prop
- Renders the parcel boundary as a blue polygon overlay on the map
- Centers the map on the parcel
- Uses OpenStreetMap tiles (free, no API key)
- Shows satellite imagery tile option if available

Create `src/app/components/FileUpload.tsx`:
- Drag and drop zone for PDF files
- Upload progress indicator
- Accepts only PDF files

Create `src/app/components/AerialViewer.tsx`:
- Displays aerial PDF pages (either as rendered images or via react-pdf)
- Page navigation (prev/next)
- Shows year label for each page if available

Create `src/app/page.tsx`:
- Full workflow layout:
  1. Top section: AddressInput + ParcelMap side by side
  2. Middle section: FileUpload
  3. Bottom section: AerialViewer showing uploaded pages with the parcel map alongside
- Pipeline status: Address → Parcel Found → PDF Uploaded → Processing → Complete

**Step 6: Wire the flow**

Make the full user journey work:
1. Enter address → see parcel boundary on the map
2. Upload aerial PDF → see it displayed
3. Both visible together so the user can visually compare the boundary location with the aerial photos

**Step 7: Commit and deploy**

```bash
git add . && git commit -m "feat: parcel boundary lookup + aerial viewer pipeline" && git push origin main
```

Verify Vercel deploys and the live URL works.

**PASTE END ↑**

---

## If Regrid API Token Isn't Available

Isiah may provide one during the interview, or AMA Earth may have one you can use. If not:

**Fallback plan:** Mock the Regrid response with a hardcoded GeoJSON polygon for the sample property. Build everything else real. Show Isiah: "the Regrid integration point is here, I've mocked it with sample data, and when we plug in the real token, the boundary will come from their API." That's acceptable for a 1-hour build.

To create a mock, use a real GeoJSON polygon. Go to geojson.io, draw a rough boundary around a known property, copy the GeoJSON. Hardcode it in the Regrid wrapper as a fallback when no token is set.

## The Three Phases for the Live Build

If this is the exact task Isiah gives you, here's how to phase it:

**Phase 1 (15 min): Address → Parcel Boundary on Map**
- Regrid API integration (or mock)
- Geocoding
- Leaflet map displaying the boundary polygon
- This is demo-able in 15 minutes. Isiah sees a working feature immediately.

**Phase 2 (20 min): PDF Upload + Display**
- File upload to Supabase
- PDF rendering in the browser (iframe or react-pdf)
- Side-by-side layout: aerial photo + parcel map
- Push to Vercel. Second demo checkpoint.

**Phase 3 (15 min): Overlay + Export**
- Draw the parcel polygon onto the aerial image (Sharp or Canvas)
- Generate annotated PDF for download
- This is the stretch goal. Getting even partial progress here is impressive.

**Buffer (10 min):** Plan + setup + demo + questions
