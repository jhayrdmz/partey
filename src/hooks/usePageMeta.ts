import { useEffect } from "react";

const SITE = "https://joinpartey.com";

/** Find or create a <meta>/<link> in <head>, returning it and its previous value. */
function upsert(selector: string, create: () => HTMLElement, attr: "content" | "href", value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  const previous = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return () => {
    if (created) el!.remove();
    else if (previous !== null) el!.setAttribute(attr, previous);
  };
}
/** A new <meta name|property="…">. */
const meta = (key: "name" | "property", id: string) => () => {
  const m = document.createElement("meta");
  m.setAttribute(key, id);
  return m;
};

/**
 * Per-page SEO for the public pages: title, description, canonical URL and the matching Open Graph /
 * Twitter tags (index.html holds the site-wide defaults, which crawlers that don't run JS use), plus
 * optional JSON-LD structured data. Everything is restored when the page unmounts.
 */
export function usePageMeta({ title, description, path, jsonLd }: { title: string; description: string; path: string; jsonLd?: object }) {
  useEffect(() => {
    const url = `${SITE}${path}`;
    const prevTitle = document.title;
    document.title = title;
    const restore = [
      upsert('meta[name="description"]', meta("name", "description"), "content", description),
      upsert('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url),
      upsert('meta[property="og:url"]', meta("property", "og:url"), "content", url),
      upsert('meta[property="og:title"]', meta("property", "og:title"), "content", title),
      upsert('meta[property="og:description"]', meta("property", "og:description"), "content", description),
      upsert('meta[name="twitter:title"]', meta("name", "twitter:title"), "content", title),
      upsert('meta[name="twitter:description"]', meta("name", "twitter:description"), "content", description),
    ];
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.pageMeta = path;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      document.title = prevTitle;
      restore.forEach((r) => r());
      script?.remove();
    };
  }, [title, description, path, jsonLd]);
}
