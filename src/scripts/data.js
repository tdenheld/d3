import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import * as topojson from 'https://esm.sh/topojson-client@3';

export const fetchGeoData = async () => {
  const [world50, world110, wbRaw, rcRaw, medianAgeCsv] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then((r) => r.json()),
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((r) => r.json()),
    fetch('https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=300&mrv=1').then((r) => r.json()),
    fetch('https://restcountries.com/v3.1/all?fields=ccn3,cca3,name,population').then((r) => r.json()),
    fetch('https://ourworldindata.org/grapher/median-age.csv?v=1&csvType=full&useColumnShortNames=true').then((r) => r.text()),
  ]);

  const countries50 = topojson.feature(world50, world50.objects.countries).features;
  const countries110 = topojson.feature(world110, world110.objects.countries).features;
  const borders50 = topojson.mesh(world50, world50.objects.countries, (a, b) => a !== b);
  const borders110 = topojson.mesh(world110, world110.objects.countries, (a, b) => a !== b);

  // alpha-3 → numeric ISO code lookups
  const alpha3ToNumeric = new Map(rcRaw.map((c) => [c.cca3, c.ccn3]));
  const nameByNumeric = new Map(
    rcRaw.filter((c) => c.ccn3 && c.ccn3 !== '000').map((c) => [c.ccn3, c.name.common]),
  );
  const popByNumeric = new Map(
    rcRaw.filter((c) => c.ccn3 && c.ccn3 !== '000' && c.population != null).map((c) => [c.ccn3, c.population]),
  );

  const gdpByNumeric = new Map();
  for (const record of wbRaw[1] ?? []) {
    const id = alpha3ToNumeric.get(record.countryiso3code);
    if (id && id !== '000') {
      if (record.value !== null) gdpByNumeric.set(id, record.value);
      if (!nameByNumeric.has(id)) nameByNumeric.set(id, record.country.value);
    }
  }

  // Median age: most recent observation per country
  const medianAgeByNumeric = new Map();
  const rows = d3.csvParse(medianAgeCsv);
  const valueCols = rows.columns.filter((c) => c !== 'entity' && c !== 'code' && c !== 'year');
  const latestByCode = new Map();
  for (const row of rows) {
    const code = row.code;
    const year = +row.year;
    if (!code || !Number.isFinite(year)) continue;
    let value = NaN;
    for (const col of valueCols) {
      const v = +row[col];
      if (Number.isFinite(v) && row[col] !== '') { value = v; break; }
    }
    if (!Number.isFinite(value)) continue;
    const prev = latestByCode.get(code);
    if (!prev || year > prev.year) latestByCode.set(code, { year, value });
  }
  for (const [code, { value }] of latestByCode) {
    const id = alpha3ToNumeric.get(code);
    if (id && id !== '000') medianAgeByNumeric.set(id, value);
  }

  return {
    countries50,
    countries110,
    borders50,
    borders110,
    nameByNumeric,
    popByNumeric,
    gdpByNumeric,
    medianAgeByNumeric,
  };
};
