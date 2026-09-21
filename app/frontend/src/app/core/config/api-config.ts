import { environment } from '../../../environments/environment';

export const API = {
  // The environments hold only the server origin; every API route is versioned under /api/v1
  baseUrl: `${environment.apiUrl}/api/v1`,
};
