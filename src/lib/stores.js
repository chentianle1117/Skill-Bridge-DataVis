// src/lib/stores.js
import { writable, derived } from 'svelte/store';

// Configuration
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiY2hlbnRpYW5sZTExMTcxIiwiYSI6ImNtMm5nOGM4czA1bXAyaW9tNHpjc3Nxcm4ifQ.3xE1IvH1OdYxE3WUvH3vVw';

// Utility function for safe store updates
function createSetStore(initialValue = new Set()) {
  const { subscribe, set, update } = writable(initialValue);
  
  return {
    subscribe,
    set: (newValue) => {
      if (newValue instanceof Set) {
        set(newValue);
      } else {
        set(new Set(newValue));
      }
    },
    add: (item) => update(store => {
      store.add(item);
      return store;
    }),
    delete: (item) => update(store => {
      store.delete(item);
      return store;
    }),
    clear: () => set(new Set()),
    update
  };
}


// Make the category cache reactive
export const categoryNormalizeCache = writable(new Map());

// Create stores with safe Set operations
export const selectedSkills = createSetStore();
export const selectedSubcategories = createSetStore();
export const highlightedJobs = createSetStore();
export const visibleJobs = writable([]);
export const hasVisibleJobs = derived(
  visibleJobs,
  $visibleJobs => $visibleJobs && $visibleJobs.length > 0
);
export const cachedJobs = writable({
  remote: [],
  nonRemote: []
});

// Add a derived store for job counts
export const jobCounts = derived(
  cachedJobs,
  $cachedJobs => ({
    remote: $cachedJobs.remote?.length || 0,
    nonRemote: $cachedJobs.nonRemote?.length || 0
  })
);

// Map markers store
export const mapMarkers = writable({
  remote: [],
  nonRemote: new Map()
});

// Combined data store for better performance
export const combinedJobData = writable({
  jobs: new Map(),
  skills: new Map(),
  subcategories: new Map()
});

// Make the normalization function reactive
export function normalizeCategory(category) {
  if (!category) return '';
  let cache;
  categoryNormalizeCache.subscribe(c => cache = c)();
  
  if (cache.has(category)) {
    return cache.get(category);
  }
  
  const normalized = category.toLowerCase()
    .replace(/[\s/-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  categoryNormalizeCache.update(c => {
    c.set(category, normalized);
    return c;
  });
  
  return normalized;
}

// Helper function to merge and normalize data
export function mergeCombinedData(jobsData, skillsData) {
  if (!jobsData || !skillsData) return;

  const jobMap = new Map();
  const skillMap = new Map();
  const subcategoryMap = new Map();
  
  // Index jobs by subcategory for faster lookups
  jobsData.forEach(job => {
    if (!job.subcategory) return;
    
    const normalizedSubcat = normalizeCategory(job.subcategory);
    if (!jobMap.has(normalizedSubcat)) {
      jobMap.set(normalizedSubcat, new Set());
    }
    jobMap.get(normalizedSubcat).add(job);
    
    // Store original subcategory mapping
    if (!subcategoryMap.has(normalizedSubcat)) {
      subcategoryMap.set(normalizedSubcat, job.subcategory);
    }
  });

  // Index skills
  skillsData.skills?.forEach(skill => {
    if (!skill.name) return;
    
    const normalizedSkill = normalizeCategory(skill.name);
    skillMap.set(normalizedSkill, {
      ...skill,
      normalizedConnections: {
        required: skill.connections?.required?.map(normalizeCategory) || [],
        preferred: skill.connections?.preferred?.map(normalizeCategory) || []
      }
    });
  });

  // Add subcategories from skills data
  skillsData.subcategories?.forEach(subcat => {
    if (!subcat.name) return;
    
    const normalizedSubcat = normalizeCategory(subcat.name);
    if (!subcategoryMap.has(normalizedSubcat)) {
      subcategoryMap.set(normalizedSubcat, subcat.name);
    }
  });

  combinedJobData.set({ 
    jobs: jobMap, 
    skills: skillMap,
    subcategories: subcategoryMap
  });
}

// Create a derived store for the selected jobs
export const selectedJobs = derived(
  [selectedSubcategories, combinedJobData],
  ([$selectedSubcategories, $combinedJobData], set) => {
    const shouldShowAll = !$selectedSubcategories || $selectedSubcategories.size === 0;
    if (shouldShowAll) {
      set(new Set());
      return;
    }

    try {
      const normalizedCategories = new Set(
        Array.from($selectedSubcategories).map(normalizeCategory)
      );

      const selectedJobs = new Set();
      $combinedJobData.jobs.forEach((jobs, category) => {
        if (normalizedCategories.has(normalizeCategory(category))) {
          jobs.forEach(job => selectedJobs.add(job.job_id));
        }
      });

      set(selectedJobs);
    } catch (error) {
      console.error('Error updating selected jobs:', error);
      set(new Set());
    }
  }
);

// Export the Mapbox access token
export const MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN;

// Helper functions for store updates
export function updateSet(store, values, operation = 'set') {
  if (!store || !store.update) return;
  
  store.update(currentSet => {
    const newSet = new Set(currentSet);
    
    switch (operation) {
      case 'set':
        newSet.clear();
        values.forEach(value => newSet.add(value));
        break;
      case 'add':
        values.forEach(value => newSet.add(value));
        break;
      case 'delete':
        values.forEach(value => newSet.delete(value));
        break;
      case 'clear':
        newSet.clear();
        break;
    }
    
    return newSet;
  });
}

// Export a function to initialize all stores
export function initializeStores() {
  selectedSkills.set(new Set());
  selectedSubcategories.set(new Set());
  highlightedJobs.set(new Set());
  visibleJobs.set([]);
  mapMarkers.set({ remote: [], nonRemote: new Map() });
  categoryNormalizeCache.set(new Map());
  combinedJobData.set({
    jobs: new Map(),
    skills: new Map(),
    subcategories: new Map()
  });
  visibleBounds.set({
    minLat: null,
    maxLat: null,
    minLng: null,
    maxLng: null,
    isZoomed: false
  });
}

// Add this near the other store definitions
export const visibleBounds = writable({
  minLat: null,
  maxLat: null,
  minLng: null,
  maxLng: null,
  isZoomed: false
});

export const hoveredJobCategory = writable({
  subcategory: null,
  isRemote: null
});