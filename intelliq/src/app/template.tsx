/**
 * Unlike layout.tsx, a template is re-mounted on every navigation, so the fade in globals.css replays for each page.
 * It is plain CSS (no client JavaScript): the page content is already in the server-rendered HTML, so nothing is hidden
 * when scripts are slow or off, and redirects and 404 responses are unaffected.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
