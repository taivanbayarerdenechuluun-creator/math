/**
 * The page background: one fixed, decorative layer behind every page. Light pools drift slowly (transform-only
 * animations, no blur filters), over a faint grid and film grain. Colours come from the --at-* tokens, so it follows
 * the theme. Styles live in globals.css (".atmos-*").
 */
export function Atmosphere() {
  return (
    <div className="atmos" aria-hidden="true">
      <div className="atmos-orb atmos-a" />
      <div className="atmos-orb atmos-b" />
      <div className="atmos-orb atmos-c" />
      <div className="atmos-orb atmos-d" />
      <div className="atmos-aurora" />
      <div className="atmos-grid" />
      <div className="atmos-noise" />
    </div>
  );
}
