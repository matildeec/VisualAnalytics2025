const vesselTypeColors = {
    'FishingVessel': 'var(--chart-vessel-fishing)',
    'CargoVessel': 'var(--chart-vessel-cargo)',
    'Ferry.Cargo': 'var(--chart-vessel-ferry-cargo)',
    'Ferry.Passenger': 'var(--chart-vessel-ferry-passenger)',
    'Tour': 'var(--chart-vessel-tour)',
    'Research': 'var(--chart-vessel-research)',
    'Other': 'var(--chart-vessel-other)'
};

const commodityColors = {
    illegal: 'var(--commodity-illegal)',
    suspect: 'var(--commodity-suspect)',
    legal:   'var(--commodity-legal)'
};

export const illegalCommodities = new Set([
  'piscesfoetidaae7', 
  'piscisosseusb6d', 
  'piscessatisb87'
]);

export const suspectCommodities = new Set([
  'piscesfrigus900', 
  'labridaenrefert9be', 
  'habeaspisces4eb', 
  'thunnininveradb7'
]);

export const getCommodityColor = (commodity_id) => {
    if (illegalCommodities.has(commodity_id)) return commodityColors.illegal;
    if (suspectCommodities.has(commodity_id)) return commodityColors.suspect;
    return commodityColors.legal;
};

export const commodityStyles = {
    illegal: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100',
    suspect: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-100',
    legal:   'bg-emerald-50 text-emerald-700 border-emerald-100'
};

export const fishIcons = {
  'gadusnspecificatae4ba': 'fish-icon-default.svg',
  'piscesfrigus900': 'fish-icon-amber.svg',
  'piscesfoetidaae7': 'fish-icon-red.svg',
  'labridaenrefert9be': 'fish-icon-amber.svg',
  'habeaspisces4eb': 'fish-icon-amber.svg',
  'piscissapidum9b7': 'fish-icon-default.svg',
  'thunnininveradb7': 'fish-icon-amber.svg',
  'piscisosseusb6d': 'fish-icon-red.svg',
  'oncorhynchusrosea790': 'fish-icon-default.svg',
  'piscessatisb87': 'fish-icon-red.svg',
  'default': 'fish-icon-default.svg'
};

export const getCommodityStatus = (id) => {
    if (illegalCommodities.has(id)) return 'illegal';
    if (suspectCommodities.has(id)) return 'suspect';
    return 'legal';
};

export const getVesselColor = (vessel_type) => {
    return vesselTypeColors[vessel_type] || vesselTypeColors['Other'];
};

export const getFishIcon = (commodity_id) => {
  return fishIcons[commodity_id] || fishIcons['default'];
};

export const illegalFishingZones = new Set([
  'Don Limpet Preserve',
  'Nemo Reef',
  'Ghoti Preserve'
]);

export const getZoneFill = (kind) => {
    switch (kind) {
        case 'Fishing Ground':
            return 'var(--zone-fishing-bg)';
        case 'Ecological Preserve':
            return 'var(--zone-preserve-bg)';
        case 'Island':
            return 'var(--zone-island-bg)';
        case 'buoy':
            return 'var(--zone-buoy-bg)';
        case 'city':
            return 'var(--zone-city-bg)';
        default:
            return 'var(--zone-default-bg)';
    }
};

export const getZoneBorder = (kind) => {
    switch (kind) {
        case 'Fishing Ground':
            return 'var(--zone-fishing-border)';
        case 'Ecological Preserve':
            return 'var(--zone-preserve-border)';
        case 'Island':
            return 'var(--zone-island-border)';
        case 'buoy':
            return 'var(--zone-buoy-border)';
        case 'city':
            return 'var(--zone-city-border)';
        default:
            return 'var(--zone-default-border)';
    }
};

const calculateTooltipPosition = (event) => {
    const tooltipWidth = 140; // Approximate width
    const tooltipHeight = 90; // Approximate height
    const padding = 15;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Check Right Edge
    if (x + tooltipWidth > windowWidth) {
        x = event.clientX - tooltipWidth - padding;
    }

    // Check Bottom Edge
    if (y + tooltipHeight > windowHeight) {
        y = event.clientY - tooltipHeight - padding;
    }

    // Check Left Edge
    if (x < 0) x = padding;

    return { x, y };
};

export const showTooltip = (event, contentDict, tooltipRef, variant) => {
    const { x, y } = calculateTooltipPosition(event);
    tooltipRef.value = {
        visible: true,
        x: x,
        y: y,
        contentDict: contentDict,
        variant: variant || 'default'
    };
};

export const hideTooltip = (tooltipRef) => {
    tooltipRef.value.visible = false;
};