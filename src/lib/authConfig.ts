import { Configuration, LogLevel } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common'; // Use "common" if multi-tenant, or specific tenant ID for single-tenant
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || 'missing-client-id';

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin, // e.g., http://localhost:5173
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      }
    }
  }
};

// Add scopes here for ID token to be used at MS Identity Platform endpoints
export const loginRequest = {
  scopes: ['User.Read']
};
