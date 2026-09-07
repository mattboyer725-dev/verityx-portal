import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { VxMark } from "@/components/vx-mark";
import { SurfaceLoop } from "@/components/surface-loop";

export function AppNotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-ink text-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <VxMark className="vx-mark-hero" title="VerityX" />
        <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-mute">404</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">This path is not on the product.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
          Hub, desk, field, core, OS, and command are the live surfaces. Anything else is off the map.
        </p>
        <SurfaceLoop className="mt-8" />
        <p className="mt-8">
          <Link to="/" className="text-sm text-gold hover:text-paper">
            Back to the platform hub →
          </Link>
        </p>
      </section>
      <div className="mx-auto w-full max-w-6xl px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
