import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = { title: 'Disclaimer (DRAFT)' };

export default function DisclaimerPage(): ReactElement {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink-100">Disclaimer</h1>

      <h2>Estimates, not guarantees</h2>
      <p>
        Ballistic Forge computes trajectory estimates from a point-mass model. A point-mass model
        treats the bullet as a particle with a drag coefficient; it does not model yaw, pitch
        damping, or the behaviour of an individual projectile leaving an individual barrel. Its
        output is a starting point for live fire, not a substitute for it.
      </p>

      <h2>Your inputs set the limit</h2>
      <p>
        A solution can only be as accurate as the muzzle velocity, ballistic coefficient and
        atmospheric conditions you give it. Advertised velocities are measured in test barrels and
        routinely differ from what your rifle produces. Published ballistic coefficients vary with
        velocity and between lots.
      </p>

      <h2>Where accuracy degrades</h2>
      <ul>
        <li>
          Transonic flight (roughly Mach 1.2 and below) — standard drag functions lose fidelity
          here, and these rows are flagged in the output.
        </li>
        <li>Extreme ranges, extreme angles, and conditions far from where you zeroed.</li>
        <li>
          Spin drift and aerodynamic jump, which are empirical approximations rather than derived
          results.
        </li>
      </ul>

      <h2>Safety and the law</h2>
      <p>
        You are responsible for the safe handling of your firearms, for positively identifying your
        target and what lies beyond it, and for complying with every law that applies to you.
        Ballistic Forge gives no legal advice, no advice on suppressor ownership or transfer, and no
        reloading data — no powder types, no charge weights, no pressure guidance. Consult current
        published reloading manuals from component manufacturers for load development.
      </p>

      <h2>No warranty</h2>
      <p>
        The software is provided as is, without warranty of any kind. To the maximum extent
        permitted by law, the authors are not liable for any damage or loss arising from its use.
      </p>
    </>
  );
}
