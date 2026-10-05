/**
 * Local Storage & State Management Service
 * 
 * Totalmente autónomo y local.
 * No se vincula a ninguna base de datos externa ni remota.
 * Almacenamiento seguro en navegador con soporte para múltiples pestañas vía BroadcastChannel.
 */

import { MeasurementPoint, MaterialItem, CostCategory, JunctionBox } from '../types';

export const STORAGE_KEYS = {
  POINTS: 'smurfit_vibration_points_v1',
  MATERIALS: 'smurfit_vibration_materials_v1',
  COSTS: 'smurfit_vibration_costs_v1',
  BOXES: 'smurfit_vibration_boxes_v1',
  LAST_SYNC: 'smurfit_vibration_last_sync'
};

// BroadcastChannel para sincronizar en tiempo real entre pestañas abiertas del navegador
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('smurfit_vibration_sync_channel') 
  : null;

type StorageEventListener = (data: { type: 'points' | 'materials' | 'costs' | 'boxes'; payload: any }) => void;
const listeners: Set<StorageEventListener> = new Set();

if (channel) {
  channel.onmessage = (event) => {
    if (event.data && event.data.type) {
      listeners.forEach(fn => {
        try {
          fn(event.data);
        } catch (err) {
          console.error('Error en listener de BroadcastChannel:', err);
        }
      });
    }
  };
}

const notifySync = (type: 'points' | 'materials' | 'costs' | 'boxes', payload: any) => {
  if (channel) {
    channel.postMessage({ type, payload });
  }
};

// ============================================================================
// PUNTOS DE MEDICIÓN (Local)
// ============================================================================

export const loadPoints = async (): Promise<MeasurementPoint[] | null> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.POINTS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (error) {
    console.error('Error cargando puntos de almacenamiento local:', error);
    return null;
  }
};

export const saveAllPoints = async (points: MeasurementPoint[]): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(points));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    notifySync('points', points);
  } catch (error) {
    console.error('Error guardando puntos en almacenamiento local:', error);
  }
};

export const saveSinglePoint = async (point: MeasurementPoint): Promise<void> => {
  try {
    const points = (await loadPoints()) || [];
    const index = points.findIndex(p => p.id === point.id);
    if (index >= 0) {
      points[index] = point;
    } else {
      points.push(point);
    }
    await saveAllPoints(points);
  } catch (error) {
    console.error('Error guardando punto en almacenamiento local:', error);
  }
};

export const deletePoint = async (pointId: string): Promise<void> => {
  try {
    const points = (await loadPoints()) || [];
    const updated = points.filter(p => p.id !== pointId);
    await saveAllPoints(updated);
  } catch (error) {
    console.error('Error eliminando punto de almacenamiento local:', error);
  }
};

export const deleteMultiplePoints = async (pointIds: string[]): Promise<void> => {
  try {
    const idSet = new Set(pointIds);
    const points = (await loadPoints()) || [];
    const updated = points.filter(p => !idSet.has(p.id));
    await saveAllPoints(updated);
  } catch (error) {
    console.error('Error eliminando múltiples puntos:', error);
  }
};

// ============================================================================
// MATERIALES (Local)
// ============================================================================

export const loadMaterials = async (): Promise<MaterialItem[] | null> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (error) {
    console.error('Error cargando materiales de almacenamiento local:', error);
    return null;
  }
};

export const saveAllMaterials = async (materials: MaterialItem[]): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
    notifySync('materials', materials);
  } catch (error) {
    console.error('Error guardando materiales en almacenamiento local:', error);
  }
};

// ============================================================================
// COSTOS / CATEGORÍAS (Local)
// ============================================================================

export const loadCosts = async (): Promise<CostCategory[] | null> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COSTS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (error) {
    console.error('Error cargando costos de almacenamiento local:', error);
    return null;
  }
};

export const saveAllCosts = async (costs: CostCategory[]): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEYS.COSTS, JSON.stringify(costs));
    notifySync('costs', costs);
  } catch (error) {
    console.error('Error guardando costos en almacenamiento local:', error);
  }
};

// ============================================================================
// CAJAS DE CONEXIONES (Local)
// ============================================================================

export const loadBoxes = async (): Promise<JunctionBox[] | null> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOXES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (error) {
    console.error('Error cargando cajas de conexiones de almacenamiento local:', error);
    return null;
  }
};

export const saveAllBoxes = async (boxes: JunctionBox[]): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEYS.BOXES, JSON.stringify(boxes));
    notifySync('boxes', boxes);
  } catch (error) {
    console.error('Error guardando cajas en almacenamiento local:', error);
  }
};

// ============================================================================
// SUSCRIPCIÓN EN TIEMPO REAL (Entre pestañas locales)
// ============================================================================

export const subscribeToPoints = (callback: (points: MeasurementPoint[]) => void) => {
  const handler: StorageEventListener = (data) => {
    if (data.type === 'points' && Array.isArray(data.payload)) {
      callback(data.payload);
    }
  };
  listeners.add(handler);

  // Escuchar también evento estándar storage
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.POINTS && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          callback(parsed);
        }
      } catch (err) {
        // Ignorar
      }
    }
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    listeners.delete(handler);
    window.removeEventListener('storage', storageHandler);
  };
};

// Aliases para compatibilidad sin base de datos externa
export const saveAllPointsToFirebase = saveAllPoints;
export const saveSinglePointToFirebase = saveSinglePoint;
export const deletePointFromFirebase = deletePoint;
export const deleteMultiplePointsFromFirebase = deleteMultiplePoints;
export const loadPointsFromFirebase = loadPoints;

export const saveAllMaterialsToFirebase = saveAllMaterials;
export const loadMaterialsFromFirebase = loadMaterials;

export const saveAllCostsToFirebase = saveAllCosts;
export const loadCostsFromFirebase = loadCosts;

export const saveAllBoxesToFirebase = saveAllBoxes;
export const loadBoxesFromFirebase = loadBoxes;
