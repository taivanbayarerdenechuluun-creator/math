import { Navbar } from "@/components/Navbar";
import { NotFoundView } from "@/components/PageChrome";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main" className="grid min-h-screen place-items-center px-4 text-center">
        <NotFoundView />
      </main>
    </>
  );
}
