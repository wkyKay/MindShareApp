declare const process: {
  env?: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const configuredApiBaseUrl =
  typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE_URL?.trim() : undefined;

// Expo Go 真机调试需要使用电脑在同一 Wi-Fi 下的局域网 IP。
// export const API_BASE_URL = configuredApiBaseUrl || 'http://10.32.233.242:8000';
export const API_BASE_URL = configuredApiBaseUrl || 'http://192.168.1.12:8000';

export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
