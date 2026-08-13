import { MtgaCardItem } from '../types';

export interface MtgaFetchResult {
  cards: MtgaCardItem[];
  count: number;
  status: string;
  error?: string;
}

export async function fetchMtgaCollection(customPath?: string): Promise<MtgaFetchResult> {
  try {
    const savedPath = customPath || localStorage.getItem('mtga_path') || '';
    const query = savedPath ? `?dbPath=${encodeURIComponent(savedPath)}` : '';
    const response = await fetch(`/api/mtga/cards${query}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return {
      cards: data.cards || [],
      count: data.count || 0,
      status: data.status || 'success',
      error: data.error
    };
  } catch (error: any) {
    console.error('Failed to fetch MTGA collection:', error);
    return {
      cards: [],
      count: 0,
      status: 'error',
      error: error.message || 'Could not connect to local MTG Arena log service.'
    };
  }
}
