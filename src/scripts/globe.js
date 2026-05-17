import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { fetchGeoData } from './data.js';
import { createColorScales, palette, WATER_COLOR, BORDER_COLOR, GRATICULE_COLOR, HOVER_COLOR } from './colors.js';
import { makeDrag } from './drag.js';

// ── Data ──────────────────────────────────────────────────────────────────
const data = await fetchGeoData();
const { countries50, countries110, borders50, borders110, nameByNumeric, popByNumeric, gdpByNumeric, medianAgeByNumeric } = data;
const { gdpValues, ageValues, getCountryColor, setMetric, getMetric } = createColorScales(data);

// ── Projection ────────────────────────────────────────────────────────────
const padding = window.innerWidth < 600 ? 32 : 128;
const width = Math.min(window.innerWidth, window.innerHeight) - padding * 2;
const sphere = { type: 'Sphere' };
const projection = d3.geoOrthographic().fitWidth(width, sphere);
const [[x0, y0], [x1, y1]] = d3.geoPath(projection.fitWidth(width, sphere)).bounds(sphere);
const dy = Math.ceil(y1 - y0);
const len = Math.min(Math.ceil(x1 - x0), dy);
projection.scale((projection.scale() * (len - 1)) / len).precision(0.2);
const height = dy;

// ── Graticule ─────────────────────────────────────────────────────────────
const graticuleLines = {
  type: 'FeatureCollection',
  features: [
    ...[0, 23.436, -23.436, 66.564, -66.564].map((lat) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: d3.range(-180, 181, 1).map((lng) => [lng, lat]) },
    })),
    ...d3.range(-165, 181, 15).map((lng) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: d3.range(-90, 91, 1).map((lat) => [lng, lat]) },
    })),
  ],
};

// ── Terrain texture ───────────────────────────────────────────────────────
const terrainImg = new Image();
terrainImg.src = '/earth-topology.png';
const terrainReady = new Promise((resolve) => { terrainImg.onload = resolve; });
await terrainReady;

const terrainCanvas = document.createElement('canvas');
terrainCanvas.width = terrainImg.width;
terrainCanvas.height = terrainImg.height;
const terrainCtx = terrainCanvas.getContext('2d');
terrainCtx.drawImage(terrainImg, 0, 0);
const terrainData = terrainCtx.getImageData(0, 0, terrainImg.width, terrainImg.height).data;
const texW = terrainImg.width;
const texH = terrainImg.height;

// ── Canvas (HiDPI) ────────────────────────────────────────────────────────
const dpr = window.devicePixelRatio || 1;
const canvas = Object.assign(document.createElement('canvas'), {
  width: width * dpr,
  height: height * dpr,
});
canvas.style.cssText = `width:${width}px;height:${height}px;cursor:grab;border-radius:50%;display:block`;
const context = canvas.getContext('2d');
context.scale(dpr, dpr);
const path = d3.geoPath(projection, context);

// ── Terrain overlay helper ─────────────────────────────────────────────────
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');
let offImgData = null;

const renderTerrainOverlay = (fast = false) => {
  const cw = Math.round(canvas.width / dpr);
  const ch = Math.round(canvas.height / dpr);
  const step = fast ? 4 : 2; // coarser during drag for performance

  // Reuse offscreen canvas; resize only when needed
  if (offscreen.width !== cw || offscreen.height !== ch) {
    offscreen.width = cw;
    offscreen.height = ch;
    offImgData = offCtx.createImageData(cw, ch);
  }

  const pixels = offImgData.data;
  // Clear previous frame data
  pixels.fill(0);

  for (let y = 0; y < ch; y += step) {
    for (let x = 0; x < cw; x += step) {
      const coords = projection.invert([x, y]);
      if (!coords) continue;
      const [lon, lat] = coords;
      // Convert lon/lat to equirectangular texture coordinates
      const tx = ((lon + 180) / 360) * texW;
      const ty = ((90 - lat) / 180) * texH;
      const ix = Math.min(Math.floor(tx), texW - 1);
      const iy = Math.min(Math.floor(ty), texH - 1);
      const val = 255 - terrainData[(iy * texW + ix) * 4]; // inverted grayscale

      // Fill the step×step block
      for (let dy = 0; dy < step && y + dy < ch; dy++) {
        for (let dx = 0; dx < step && x + dx < cw; dx++) {
          const idx = ((y + dy) * cw + (x + dx)) * 4;
          pixels[idx] = val;
          pixels[idx + 1] = val;
          pixels[idx + 2] = val;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  offCtx.putImageData(offImgData, 0, 0);

  // Clip to sphere and composite
  context.save();
  context.beginPath();
  path(sphere);
  context.clip();
  context.globalCompositeOperation = 'soft-light';
  context.globalAlpha = 0.9;
  context.drawImage(offscreen, 0, 0);
  context.restore();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
};

// ── Render ────────────────────────────────────────────────────────────────
let hoveredId = null;

const render = (countries, borders, fast = false) => {
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.beginPath();
  path(sphere);
  context.fillStyle = WATER_COLOR;
  context.fill();

  for (const country of countries) {
    context.beginPath();
    path(country);
    context.fillStyle = getCountryColor(country.id);
    context.fill();
  }

  if (hoveredId) {
    const hovered = countries.find((f) => f.id === hoveredId);
    if (hovered) {
      context.beginPath();
      path(hovered);
      context.fillStyle = HOVER_COLOR;
      context.fill();
    }
  }

  // Terrain texture overlay
  renderTerrainOverlay(fast);

  context.beginPath();
  path(borders);
  context.strokeStyle = BORDER_COLOR;
  context.lineWidth = 0.5;
  context.stroke();

  context.beginPath();
  path(graticuleLines);
  context.strokeStyle = GRATICULE_COLOR;
  context.lineWidth = 0.7;
  context.stroke();

  context.beginPath();
  path(sphere);
  context.strokeStyle = WATER_COLOR;
  context.lineWidth = 1.5;
  context.stroke();

  // Atmospheric edge glow / light gradient
  const cx = projection.translate()[0];
  const cy = projection.translate()[1];
  const r = projection.scale();
  const edgeGradient = context.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  edgeGradient.addColorStop(0, 'rgba(255,255,255,0)');
  edgeGradient.addColorStop(0.6, 'rgba(255,255,255,0)');
  edgeGradient.addColorStop(0.93, 'rgba(180,220,255,0.1)');
  edgeGradient.addColorStop(1, 'rgba(140,200,255,0.4)');
  context.beginPath();
  path(sphere);
  context.fillStyle = edgeGradient;
  context.fill();
};

// ── Drag ──────────────────────────────────────────────────────────────────
let isDragging = false;
const tooltip = document.querySelector('[data-tooltip]');

const drag = makeDrag(projection, {
  onDragStart: () => {
    isDragging = true;
    tooltip.classList.add('hidden');
    canvas.style.cursor = 'grabbing';
  },
  onDrag: () => render(countries110, borders110, true),
  onDragEnd: () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
    render(countries50, borders50);
  },
});

// ── Tooltip ───────────────────────────────────────────────────────────────
const gdpFmt = d3.format(',.0f');
const popFmt = d3.format(',.1f');
const ageFmt = d3.format('.1f');

const makeLine = (text, className = 'block text-[10px] opacity-70') => {
  const el = Object.assign(document.createElement('span'), { className });
  el.textContent = text;
  return el;
};

canvas.addEventListener('mousemove', (event) => {
  if (isDragging) { tooltip.classList.add('hidden'); return; }

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / dpr) / rect.width;
  const y = (event.clientY - rect.top) * (canvas.height / dpr) / rect.height;
  const coords = projection.invert([x, y]);
  if (!coords) { tooltip.classList.add('hidden'); return; }

  const found = countries50.find((f) => d3.geoContains(f, coords));
  if (!found) {
    canvas.style.cursor = 'grab';
    tooltip.classList.add('hidden');
    if (hoveredId !== null) { hoveredId = null; render(countries50, borders50); }
    return;
  }

  canvas.style.cursor = 'default';
  if (found.id !== hoveredId) { hoveredId = found.id; render(countries50, borders50); }

  const gdp = gdpByNumeric.get(found.id);
  const pop = popByNumeric.get(found.id);
  const medianAge = medianAgeByNumeric.get(found.id);

  tooltip.replaceChildren(
    makeLine(nameByNumeric.get(found.id) ?? found.id, 'block font-semibold mb-1'),
    makeLine(gdp != null ? '€ ' + gdpFmt(gdp) + ' per capita' : 'No GDP data'),
    makeLine(pop != null ? popFmt(pop / 1_000_000) + 'M people' : 'No population data'),
    makeLine(medianAge != null ? ageFmt(medianAge) + ' years median age' : 'No median age data'),
  );
  tooltip.classList.remove('hidden');

  const tx = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
  const ty = Math.max(event.clientY - tooltip.offsetHeight - 8, 8);
  tooltip.style.left = `${tx}px`;
  tooltip.style.top = `${ty}px`;
});

canvas.addEventListener('mouseleave', () => {
  canvas.style.cursor = 'grab';
  tooltip.classList.add('hidden');
  if (hoveredId !== null) { hoveredId = null; render(countries50, borders50); }
});

// ── Legend ─────────────────────────────────────────────────────────────────
const legendBar = document.querySelector('[data-legend-bar]');
const legendMin = document.querySelector('[data-legend-min]');
const legendMax = document.querySelector('[data-legend-max]');
const popThresholds = [1e5, 5e5, 1e6, 5e6, 1e7, 25e6, 5e7, 1e8, 25e7, 5e8];
const compactFmt = d3.format('~s');

const updateLegend = () => {
  legendBar.style.background = `linear-gradient(to right, ${palette.join(', ')})`;
  const metric = getMetric();
  if (metric === 'gdp') {
    legendMin.textContent = '$' + compactFmt(gdpValues[0]);
    legendMax.textContent = '$' + compactFmt(gdpValues[gdpValues.length - 1]);
  } else if (metric === 'population') {
    legendMin.textContent = '0';
    legendMax.textContent = compactFmt(popThresholds[popThresholds.length - 1]) + '+';
  } else {
    legendMin.textContent = ageValues[0].toFixed(0) + ' yr';
    legendMax.textContent = ageValues[ageValues.length - 1].toFixed(0) + ' yr';
  }
};
updateLegend();

// ── Metric toggle ─────────────────────────────────────────────────────────
document.querySelector('[data-metric]').addEventListener('change', (e) => {
  setMetric(e.target.value);
  updateLegend();
  render(countries50, borders50);
});

// ── Zoom ──────────────────────────────────────────────────────────────────
const initialScale = projection.scale();
const baseWidth = width;
const baseHeight = height;
let currentZoom = 1;
const minZoom = 0.5;
const maxZoom = 4;

const applyZoom = (factor) => {
  currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom * factor));
  const newWidth = baseWidth * currentZoom;
  const newHeight = baseHeight * currentZoom;

  canvas.width = newWidth * dpr;
  canvas.height = newHeight * dpr;
  canvas.style.width = `${newWidth}px`;
  canvas.style.height = `${newHeight}px`;
  canvas.style.borderRadius = '50%';

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);

  projection.scale(initialScale * currentZoom);
  projection.translate([newWidth / 2, newHeight / 2]);

  render(countries50, borders50);
};

document.querySelector('[data-zoom-in]').addEventListener('click', () => applyZoom(1.3));
document.querySelector('[data-zoom-out]').addEventListener('click', () => applyZoom(1 / 1.3));

// ── Mount ─────────────────────────────────────────────────────────────────
document.querySelector('[data-container]').append(canvas);
d3.select(canvas).call(drag);
render(countries50, borders50);
