export const BROWSER_CAMERA_URL = 'browser://camera';

export function isBrowserCameraUrl(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized === BROWSER_CAMERA_URL
    || normalized === 'rtsp://127.0.0.1:4747/live'
    || normalized?.includes('127.0.0.1:8554') === true
    || normalized?.includes('localhost:8554') === true
    || normalized?.includes('ivcam') === true;
}
