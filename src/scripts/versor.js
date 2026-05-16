// https://github.com/Fil/versor (ISC)
const _r = Math.PI / 180;
const _d = 180 / Math.PI;

const versor = ([l, p, g]) => {
  l = (l * _r) / 2;
  p = (p * _r) / 2;
  g = ((g || 0) * _r) / 2;
  const sl = Math.sin(l), cl = Math.cos(l);
  const sp = Math.sin(p), cp = Math.cos(p);
  const sg = Math.sin(g), cg = Math.cos(g);
  return [
    cl * cp * cg + sl * sp * sg,
    sl * cp * cg - cl * sp * sg,
    cl * sp * cg + sl * cp * sg,
    cl * cp * sg - sl * sp * cg,
  ];
};

versor.cartesian = ([l, p]) => {
  const a = l * _r, b = p * _r, cb = Math.cos(b);
  return [cb * Math.cos(a), cb * Math.sin(a), Math.sin(b)];
};

versor.multiply = ([a1, b1, c1, d1], [a2, b2, c2, d2]) => [
  a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
  a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
  a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
  a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2,
];

versor.rotation = ([a, b, c, d]) => [
  Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * _d,
  Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * _d,
  Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * _d,
];

versor.delta = (v0, v1) => {
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const w = cross(v0, v1), l = Math.sqrt(dot(w, w));
  if (!l) return [1, 0, 0, 0];
  const t = Math.acos(Math.max(-1, Math.min(1, dot(v0, v1)))) / 2;
  const s = Math.sin(t);
  return [Math.cos(t), (w[2] / l) * s, (-w[1] / l) * s, (w[0] / l) * s];
};

export default versor;
