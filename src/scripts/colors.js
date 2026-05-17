import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

export const WATER_COLOR = '#0C1B2A';
export const BORDER_COLOR = 'rgba(0,0,0,0.7)';
export const GRATICULE_COLOR = 'rgba(255,255,255,0.05)';
export const HOVER_COLOR = 'rgba(0,0,0,0.1)';
const noDataColor = '#666';

export const palette = [
  '#ABCCC6',
  '#98D1C8',
  '#6EBFB4',
  '#46AB9E',
  '#28938A',
  '#0D6170',
  '#05455B',
  '#0F3C57',
  '#163450',
  '#192A45',
  '#1B2439',
].reverse();

export const createColorScales = ({ gdpByNumeric, popByNumeric, medianAgeByNumeric, breadByNumeric }) => {
  const gdpValues = [...gdpByNumeric.values()].sort(d3.ascending);
  const gdpColor = d3.scaleQuantile().domain(gdpValues).range(palette);

  const popColor = d3
    .scaleThreshold()
    .domain([1e5, 5e5, 1e6, 5e6, 1e7, 25e6, 5e7, 1e8, 25e7, 5e8])
    .range(palette);

  const ageValues = [...medianAgeByNumeric.values()].sort(d3.ascending);
  const ageColor = d3.scaleQuantile().domain(ageValues).range(palette);

  const breadValues = [...breadByNumeric.values()].sort(d3.ascending);
  const breadColor = d3.scaleQuantile().domain(breadValues).range(palette);

  let activeMetric = 'gdp';

  const setMetric = (metric) => { activeMetric = metric; };
  const getMetric = () => activeMetric;

  const getCountryColor = (id) => {
    switch (activeMetric) {
      case 'gdp': {
        const v = gdpByNumeric.get(id);
        return v != null ? gdpColor(v) : noDataColor;
      }
      case 'population': {
        const v = popByNumeric.get(id);
        return v != null && v > 0 ? popColor(v) : noDataColor;
      }
      case 'medianAge': {
        const v = medianAgeByNumeric.get(id);
        return v != null ? ageColor(v) : noDataColor;
      }
      case 'bread': {
        const v = breadByNumeric.get(id);
        return v != null ? breadColor(v) : noDataColor;
      }
      default:
        return noDataColor;
    }
  };

  return { gdpValues, ageValues, breadValues, getCountryColor, setMetric, getMetric };
};
