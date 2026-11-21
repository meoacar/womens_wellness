import { DataProvider } from '@refinedev/core';
import axios, { AxiosInstance } from 'axios';
import { tryRefreshAccessToken } from './authProvider';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = axiosInstance;

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

// Handle token refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!refreshPromise) {
        refreshPromise = tryRefreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.removeItem('adminVerifiedAt');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  // GET list
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    const { current = 1, pageSize = 10 } = pagination ?? {};

    const params: any = {
      page: current,
      limit: pageSize,
    };

    // Add filters
    if (filters) {
      filters.forEach((filter) => {
        if ('field' in filter) {
          params[filter.field] = filter.value;
        }
      });
    }

    // Add sorters
    if (sorters && sorters.length > 0) {
      const sorter = sorters[0];
      params.sortBy = sorter.field;
      params.sortOrder = sorter.order;
    }

    // Handle special resource paths
    let endpoint = resource;
    if (resource === 'subscriptions') {
      endpoint = 'subscription/admin/all';
    } else if (resource === 'qna/questions') {
      endpoint = 'qna/questions';
    } else if (resource === 'qna/answers') {
      endpoint = 'qna/answers';
    } else if (resource === 'qna/reports') {
      endpoint = 'qna/moderation/reports';
    } else if (resource === 'content/articles') {
      endpoint = 'discover/articles';
    } else if (resource === 'astrology/horoscopes') {
      endpoint = 'astrology/admin/horoscopes';
    } else if (resource === 'health/cycles') {
      endpoint = 'cycles/admin/all';
    } else if (resource === 'health/pregnancy') {
      endpoint = 'pregnancy/admin/all';
    } else if (resource === 'health/postpartum') {
      endpoint = 'postpartum/admin/all';
    } else if (resource === 'health/wellness') {
      endpoint = 'wellness/v1/admin/overview';
    } else if (resource === 'reminders') {
      endpoint = 'reminders/admin/all';
    } else if (resource === 'ai-providers') {
      endpoint = 'ai-providers';
    } else if (resource === 'ai/model-policies') {
      endpoint = 'model-policies';
    } else if (resource === 'ai/quotas') {
      endpoint = 'quotas';
    } else if (resource === 'system/feature-flags') {
      endpoint = 'feature-flags';
    } else if (resource === 'system/audit-logs') {
      endpoint = 'audit-logs';
    }

    const { data } = await axiosInstance.get(`/${endpoint}`, { params });

    // Handle different response formats
    let responseData = data;
    let total = 0;

    // If response has articles property (Discover API response)
    if (data.articles && Array.isArray(data.articles)) {
      responseData = data.articles;
      total = data.total || data.articles.length;
    }
    // If response has data property (paginated response)
    else if (data.data && Array.isArray(data.data)) {
      responseData = data.data;
      total = data.total || data.data.length;
    }
    // If response has questions property (QnA response)
    else if (data.questions && Array.isArray(data.questions)) {
      responseData = data.questions;
      total = data.total || data.questions.length;
    }
    // If response has answers property
    else if (data.answers && Array.isArray(data.answers)) {
      responseData = data.answers;
      total = data.total || data.answers.length;
    }
    // If response has reports property (with pagination object)
    else if (data.reports && Array.isArray(data.reports)) {
      responseData = data.reports;
      total = data.pagination?.total || data.total || data.reports.length;
    }
    // If response is directly an array
    else if (Array.isArray(data)) {
      responseData = data;
      total = data.length;
    }
    // If response is an object with items property
    else if (data.items && Array.isArray(data.items)) {
      responseData = data.items;
      total = data.total || data.items.length;
    }
    // If response is an object with results property
    else if (data.results && Array.isArray(data.results)) {
      responseData = data.results;
      total = data.total || data.results.length;
    }
    // Fallback: wrap single object in array
    else if (typeof data === 'object' && !Array.isArray(data)) {
      responseData = [data];
      total = 1;
    }

    return {
      data: responseData,
      total: total,
    };
  },

  // GET one
  getOne: async ({ resource, id }) => {
    // Handle special resource paths
    let endpoint = resource;
    if (resource === 'subscriptions') {
      endpoint = 'subscription/admin';
    } else if (resource === 'qna/questions') {
      endpoint = 'qna/questions';
    } else if (resource === 'qna/answers') {
      endpoint = 'qna/answers';
    } else if (resource === 'qna/reports') {
      endpoint = 'qna/moderation/reports';
    } else if (resource === 'content/articles') {
      endpoint = 'discover/articles';
    } else if (resource === 'astrology/horoscopes') {
      endpoint = 'astrology/admin/horoscopes';
    } else if (resource === 'health/cycles') {
      endpoint = 'cycles/admin';
    } else if (resource === 'health/pregnancy') {
      endpoint = 'pregnancy/admin';
    } else if (resource === 'ai/model-policies') {
      endpoint = 'model-policies';
    } else if (resource === 'system/feature-flags') {
      endpoint = 'feature-flags';
    }

    const { data } = await axiosInstance.get(`/${endpoint}/${id}`);
    return { data };
  },

  // POST create
  create: async ({ resource, variables }) => {
    let endpoint = resource;
    if (resource === 'content/articles') {
      endpoint = 'discover/articles';
    } else if (resource === 'astrology/horoscopes') {
      endpoint = 'astrology/admin/horoscopes';
    } else if (resource === 'qna/questions') {
      endpoint = 'qna/questions/admin';
    } else if (resource === 'ai-providers') {
      endpoint = 'ai-providers';
    } else if (resource === 'ai/model-policies') {
      endpoint = 'model-policies';
    }

    const { data } = await axiosInstance.post(`/${endpoint}`, variables);
    return { data };
  },

  // PATCH/PUT update
  update: async ({ resource, id, variables }) => {
    let endpoint = resource;
    if (resource === 'subscriptions') {
      endpoint = 'subscription';
    } else if (resource === 'qna/questions') {
      const { data } = await axiosInstance.patch(`/qna/questions/${id}/admin`, variables);
      return { data };
    } else if (resource === 'qna/answers') {
      // Use admin update endpoint for answers
      const { data } = await axiosInstance.patch(`/qna/answers/${id}/admin`, variables);
      return { data };
    } else if (resource === 'qna/reports' || resource === 'qna/moderation/reports') {
      // Check if it's a status-only update
      const vars = variables as any;
      if (vars.status && !vars.action) {
        const { data } = await axiosInstance.patch(`/qna/moderation/reports/${id}/status`, variables);
        return { data };
      }
      endpoint = 'qna/moderation/reports';
    } else if (resource === 'content/articles') {
      endpoint = 'discover/articles';
    } else if (resource === 'astrology/horoscopes') {
      endpoint = 'astrology/admin/horoscopes';
    } else if (resource === 'ai-providers') {
      // AI providers use provider name as ID, use PUT method
      const { data } = await axiosInstance.put(`/ai-providers/${id}`, variables);
      return { data };
    } else if (resource === 'ai/model-policies') {
      endpoint = 'model-policies';
    } else if (resource === 'system/feature-flags') {
      endpoint = 'feature-flags';
    } else if (resource === 'reminders') {
      endpoint = 'reminders';
    }

    const { data } = await axiosInstance.patch(`/${endpoint}/${id}`, variables);
    return { data };
  },

  // DELETE
  deleteOne: async ({ resource, id }) => {
    let endpoint = resource;
    if (resource === 'content/articles') {
      // Use POST for delete to match API
      const { data } = await axiosInstance.post(`/discover/articles/${id}/delete`);
      return { data };
    } else if (resource === 'qna/questions') {
      const { data } = await axiosInstance.delete(`/qna/questions/${id}/admin`);
      return { data };
    } else if (resource === 'qna/answers') {
      // Use admin delete endpoint for answers
      const { data } = await axiosInstance.delete(`/qna/answers/${id}/admin`);
      return { data };
    } else if (resource === 'astrology/horoscopes') {
      endpoint = 'astrology/admin/horoscopes';
    } else if (resource === 'ai-providers') {
      // AI providers use provider name as ID
      const { data } = await axiosInstance.delete(`/ai-providers/${id}`);
      return { data };
    } else if (resource === 'ai/model-policies') {
      endpoint = 'model-policies';
    }

    const { data } = await axiosInstance.delete(`/${endpoint}/${id}`);
    return { data };
  },

  // Custom method for batch operations
  custom: async ({ url, method, filters, sorters, payload, query, headers }) => {
    let requestUrl = `${url}`;

    if (query) {
      const params = new URLSearchParams(query);
      requestUrl = `${requestUrl}?${params.toString()}`;
    }

    const { data } = await axiosInstance({
      url: requestUrl,
      method,
      data: payload,
      headers,
    });

    return { data };
  },

  // GET many (for relationships)
  getMany: async ({ resource, ids }) => {
    const promises = ids.map((id) => axiosInstance.get(`/${resource}/${id}`));
    const responses = await Promise.all(promises);
    return { data: responses.map((res) => res.data) };
  },

  // Not implemented (optional)
  createMany: async () => {
    throw new Error('createMany not implemented');
  },

  deleteMany: async () => {
    throw new Error('deleteMany not implemented');
  },

  updateMany: async () => {
    throw new Error('updateMany not implemented');
  },
};
