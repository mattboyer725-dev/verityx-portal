/**
 * Last pass over the document <head>, after the platform injector.
 *
 * 1. Production on Vercel loads no third-party builder script. The Grok App
 *    Builder injects https://grok.com/grok-app-builder/extensions.js into
 *    every page; it serves the editor, not the product, and nothing in src/
 *    depends on it. It is removed only when VERCEL_ENV=production and the app
 *    is not a grok.me publish (VITE_PUBLIC_HOSTNAME unset) — the editor
 *    preview and grok.me deploys keep it.
 * 2. Share cards carry the seal. The platform emits og:image only for custom
 *    domains, never *.vercel.app, so links shared from the live site showed no
 *    image. When none is present, og:image / twitter:image point at /og.jpg on
 *    the canonical origin (fixed, never taken from the Host header).
 */
export const SITE_ORIGIN = "https://verityx-portal.vercel.app";

const EXTENSIONS_SCRIPT = /<script\b[^>]*\bsrc="https:\/\/grok\.com\/grok-app-builder\/extensions\.js"[^>]*>\s*<\/script>/gi;
const GROK_ID_META = /<meta\b[^>]*(?:name="grok-project-id"|property="grok:app_id")[^>]*>/gi;

export function stripBuilderScript(env: Record<string, string | undefined>) {
  return env.VERCEL_ENV === "production" && !env.VITE_PUBLIC_HOSTNAME;
}

export function finishHead(head: string, env: Record<string, string | undefined>): string {
  let out = head;
  if (stripBuilderScript(env)) {
    out = out.replace(EXTENSIONS_SCRIPT, "").replace(GROK_ID_META, "");
  }
  if (!/property=["']og:image["']/i.test(out)) {
    const img = `${SITE_ORIGIN}/og.jpg`;
    const tags =
      `<meta property="og:image" content="${img}">` +
      `<meta property="og:image:width" content="1200">` +
      `<meta property="og:image:height" content="630">` +
      `<meta property="og:image:alt" content="VerityX seal">` +
      (/name=["']twitter:image["']/i.test(out) ? "" : `<meta name="twitter:image" content="${img}">`);
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${tags}</head>`) : out + tags;
  }
  return out;
}
