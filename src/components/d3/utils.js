// Utility
export async function loadDocumentsMap() {
  const res = await fetch('/data/documents.json');
  const docs = await res.json();
  const docMap = {};
  for (const doc of docs) {
    docMap[doc.id] = doc;
  }
  return docMap;
}

// Commodity -> SVG file
/*
export const fishIcons = {
  'gadusnspecificatae4ba': 'fish-icon-1.svg',
  'piscesfrigus900': 'fish-icon-2.svg',
  'piscesfoetidaae7': 'fish-icon-3.svg',
  'labridaenrefert9be': 'fish-icon-4.svg',
  'habeaspisces4eb': 'fish-icon-5.svg',
  'piscissapidum9b7': 'fish-icon-6.svg',
  'thunnininveradb7': 'fish-icon-7.svg',
  'piscisosseusb6d': 'fish-icon-8.svg',
  'oncorhynchusrosea790': 'fish-icon-9.svg',
  'piscessatisb87': 'fish-icon-10.svg',
  'default': 'fish-icon-default.svg'
};*/

export const fishIcons = {
  'gadusnspecificatae4ba': 'fish-icon-default.svg',
  'piscesfrigus900': 'fish-icon-default.svg',
  'piscesfoetidaae7': 'fish-icon-3.svg',
  'labridaenrefert9be': 'fish-icon-default.svg',
  'habeaspisces4eb': 'fish-icon-default.svg',
  'piscissapidum9b7': 'fish-icon-default.svg',
  'thunnininveradb7': 'fish-icon-default.svg',
  'piscisosseusb6d': 'fish-icon-8.svg',
  'oncorhynchusrosea790': 'fish-icon-default.svg',
  'piscessatisb87': 'fish-icon-10.svg',
  'default': 'fish-icon-default.svg'
};

export const illegalCommodities = new Set([
  'piscesfoetidaae7', 
  'piscisosseusb6d', 
  'piscessatisb87'
]);

export const illegalFishingZones = new Set([
  'Don Limpet Preserve',
  'Nemo Reef',
  'Ghoti Preserve'
]);