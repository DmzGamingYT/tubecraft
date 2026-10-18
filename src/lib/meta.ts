/**
 * Titre + métadonnées de partage par page. Une SPA n'a qu'un seul `index.html` :
 * sans cela, tous les liens partagés affichent « TubeCraft ».
 */
function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function setPageMeta(title: string, description?: string): void {
  document.title = title;
  if (description) {
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  }
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
}
