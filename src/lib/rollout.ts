// Hénon map (a = 1.4, b = 0.3), the environment Anchor was first tested on.
// "Observed" is the true trajectory; "rollout" starts 1e-6 away and drifts.
const step = ([x, y]: number[]) => [1 - 1.4 * x * x + y, 0.3 * x];

export function simulate(steps: number) {
  let s = [0.1, 0.1];
  for (let i = 0; i < 300; i++) s = step(s);

  const observed: number[] = [];
  const rollout: number[] = [];
  let a = s;
  let b = [s[0] + 1e-6, s[1]];
  for (let i = 0; i <= steps; i++) {
    observed.push(a[0]);
    rollout.push(b[0]);
    a = step(a);
    b = step(b);
  }

  const error = observed.map((v, i) => Math.abs(v - rollout[i]));
  const drift = error.findIndex((e) => e > 0.1);

  return { observed, rollout, error, drift };
}
