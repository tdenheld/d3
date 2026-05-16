import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import versor from './versor.js';

export const makeDrag = (proj, { onDragStart, onDrag, onDragEnd }) => {
  let v0, q0, r0, a0, l;

  const pointer = (event, that) => {
    const t = d3.pointers(event, that);
    if (t.length !== l) {
      l = t.length;
      if (l > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      dragstarted({ x: t[0][0], y: t[0][1] });
    }
    if (l > 1) {
      const px = d3.mean(t, (p) => p[0]);
      const py = d3.mean(t, (p) => p[1]);
      return [px, py, Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0])];
    }
    return t[0];
  };

  const dragstarted = ({ x, y }) => {
    v0 = versor.cartesian(proj.invert([x, y]));
    q0 = versor((r0 = proj.rotate()));
  };

  const dragged = function (event) {
    const p = pointer(event, this);
    const v1 = versor.cartesian(proj.rotate(r0).invert(p));
    const delta = versor.delta(v0, v1);
    let q1 = versor.multiply(q0, delta);
    if (p[2]) {
      const d = (p[2] - a0) / 2;
      const s = -Math.sin(d);
      const c = Math.sign(Math.cos(d));
      q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, s * c], q1);
    }
    proj.rotate(versor.rotation(q1));
  };

  return d3
    .drag()
    .on('start', function (event) {
      onDragStart?.();
      pointer(event, this);
    })
    .on('drag', function (event) {
      dragged.call(this, event);
      onDrag?.();
    })
    .on('end', () => {
      l = 0;
      onDragEnd?.();
    });
};
