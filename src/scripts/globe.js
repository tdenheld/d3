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

// ── Render ────────────────────────────────────────────────────────────────
let hoveredId = null;

const render = (countries, borders) => {
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
  onDrag: () => render(countries110, borders110),
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

  const nameEl = Object.assign(document.createElement('span'), { className: 'block font-semibold mb-1' });
  nameEl.textContent = nameByNumeric.get(found.id) ?? found.id;

  const gdp = gdpByNumeric.get(found.id);
  const gdpEl = Object.assign(document.createElement('span'), { className: 'block text-[10px] opacity-70' });
  gdpEl.textContent = gdp != null ? '€ ' + gdpFmt(gdp) + ' per capita' : 'No GDP data';

  const pop = popByNumeric.get(found.id);
  const popEl = Object.assign(document.createElement('span'), { className: 'block text-[10px] opacity-70' });
  popEl.textContent = pop != null ? popFmt(pop / 1_000_000) + 'M people' : 'No population data';

  const medianAge = medianAgeByNumeric.get(found.id);
  const ageEl = Object.assign(document.createElement('span'), { className: 'block text-[10px] opacity-70' });
  ageEl.textContent = medianAge != null ? ageFmt(medianAge) + ' years median age' : 'No median age data';

  tooltip.replaceChildren(nameEl, gdpEl, popEl, ageEl);
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
