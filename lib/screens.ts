import screens from './screens.json';
export type Screen = typeof screens[number];
export const allScreens = screens as Screen[];

export const findScreen = (path: string): Screen | null => {
  if (path === '/publishing-catalog/book-master') {
    const target = allScreens.find(s => s.path === '/publishing-catalog/create-book');
    if (target) {
      return { ...target, path: '/publishing-catalog/book-master', title: 'Create Book' };
    }
  }

  // Common aliases for URL flexibility
  if (path === '/book-fair-events/fair-list') {
    return allScreens.find(s => s.path === '/book-fair-events/fair-event-list') || null;
  }
  if (path === '/book-fair-events/fair-setup-booth') {
    return allScreens.find(s => s.path === '/book-fair-events/fair-setup-and-booth') || null;
  }
  if (path === '/book-fair-events/fair-profitability-report') {
    return allScreens.find(s => s.path === '/reports-analytics/book-fair-profitability-reports') || null;
  }
  if (path === '/marketing-promotions/promotion-discount-rules') {
    return allScreens.find(s => s.path === '/marketing-promotions/promotion-and-discount-rules') || null;
  }

  const match = allScreens.find(s => s.path === path);
  if (match) return match;

  // Backward compatibility alias for legacy procurement-suppliers path
  if (path.startsWith('/procurement-suppliers/')) {
    const supplierPath = path.replace('/procurement-suppliers/', '/suppliers/');
    return allScreens.find(s => s.path === supplierPath) || null;
  }

  return null;
};

export const moduleGroups = Array.from(
  new Map(allScreens.map(s => [s.moduleSlug, { label: s.module, slug: s.moduleSlug }])).values()
);
export const dashboardScreen = allScreens[0];
