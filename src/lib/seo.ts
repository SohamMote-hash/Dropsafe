import { useEffect } from 'react';
import { metaFor, type RouteId } from './routes';

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/** Keeps the document title, description and social cards in sync with the visible route. */
export function usePageMeta(route: RouteId) {
  useEffect(() => {
    const meta = metaFor(route);
    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
    setMeta('name', 'robots', route === 'not-found' ? 'noindex' : 'index,follow');
  }, [route]);
}
