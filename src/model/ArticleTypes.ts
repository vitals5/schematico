/** Portable local catalogue data. User checks are not manufacturer certification. */
export interface CatalogArticle {
  id: string;
  articleNumber: string;
  manufacturer: string;
  variant: string;
  description: string;
  origin: 'user' | 'project_import' | 'starter';
  verification: 'unverified' | 'user_checked';
  functions?: { id: string; type: string; pins: string[]; required?: boolean }[];
}
export interface AssignedArticle {
  articleNumber: string;
  manufacturer: string;
  variant: string;
  quantity?: number;
  role: 'main' | 'accessory';
  snapshot?: CatalogArticle;
}
export interface ComponentAddress {
  pageId: string;
  componentId: string;
}
export interface PhysicalDevice {
  id: string;
  main: ComponentAddress;
  members: ComponentAddress[];
  verification: 'user_confirmed';
}
