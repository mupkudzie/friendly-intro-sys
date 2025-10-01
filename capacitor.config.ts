import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.107dcc2f96e9440196b6f567985d3930',
  appName: 'garden-monitoring-system',
  webDir: 'dist',
  server: {
    url: 'https://107dcc2f-96e9-4401-96b6-f567985d3930.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
