export type GarminObject = Record<string, unknown>;

export interface GarminActivity extends GarminObject {
  activityId?: string | number;
  activityName?: string;
  activityType?: { typeKey?: string };
  activityTypeDTO?: { typeKey?: string };
  summaryDTO?: GarminObject;
}

export interface GarminSplits extends GarminObject {
  lapDTOs?: GarminObject[];
}

export interface GarminMetricDescriptor {
  key?: string;
  metricsIndex?: number;
}

export interface GarminMetricRow {
  metrics?: Array<number | null>;
}

export interface GarminDetails extends GarminObject {
  metricDescriptors?: GarminMetricDescriptor[];
  activityDetailMetrics?: GarminMetricRow[];
}

export interface GarminHeartRateZone extends GarminObject {
  zoneNumber?: number;
  secsInZone?: number;
  zoneLowBoundary?: number;
}

export interface GarminWeather extends GarminObject {
  temp?: number;
  apparentTemp?: number;
  relativeHumidity?: number;
  windSpeed?: number;
  windDirectionCompassPoint?: string;
  weatherTypeDTO?: { desc?: string };
}
