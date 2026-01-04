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

export const fishIcons = {
  'gadusnspecificatae4ba': 'fish-icon-default.svg',
  'piscesfrigus900': 'fish-icon-1.svg',
  'piscesfoetidaae7': 'fish-icon-10.svg',
  'labridaenrefert9be': 'fish-icon-1.svg',
  'habeaspisces4eb': 'fish-icon-1.svg',
  'piscissapidum9b7': 'fish-icon-default.svg',
  'thunnininveradb7': 'fish-icon-1.svg',
  'piscisosseusb6d': 'fish-icon-10.svg',
  'oncorhynchusrosea790': 'fish-icon-default.svg',
  'piscessatisb87': 'fish-icon-10.svg',
  'default': 'fish-icon-default.svg'
};

export const illegalCommodities = new Set([
  'piscesfoetidaae7', 
  'piscisosseusb6d', 
  'piscessatisb87'
]);

export const commodityStatus = new Map([
  ['piscesfoetidaae7', 'illegal'], 
  ['piscisosseusb6d', 'illegal'],
  ['piscessatisb87', 'illegal'],
  ['gadusnspecificatae4ba', 'legal'],
  ['piscesfrigus900', 'suspect'],
  ['labridaenrefert9be', 'suspect'],
  ['habeaspisces4eb', 'suspect'],
  ['piscissapidum9b7', 'legal'],
  ['thunnininveradb7', 'suspect'],
  ['oncorhynchusrosea790', 'legal']
]);

export const illegalFishingZones = new Set([
  'Don Limpet Preserve',
  'Nemo Reef',
  'Ghoti Preserve'
]);