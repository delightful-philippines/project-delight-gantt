import * as msal from '@azure/msal-node';
import 'dotenv/config';

const msalConfig = {
    auth: {
        clientId: process.env.VITE_AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.VITE_AZURE_TENANT_ID || 'common'}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                if (!containsPii) console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Info,
        }
    }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

export const getAuthUrl = (state) => {
    const authCodeUrlParameters = {
        scopes: ["user.read"],
        redirectUri: process.env.AZURE_REDIRECT_URI,
        state: state
    };

    return cca.getAuthCodeUrl(authCodeUrlParameters);
};

export const acquireTokenByCode = (code) => {
    const tokenRequest = {
        code: code,
        scopes: ["user.read"],
        redirectUri: process.env.AZURE_REDIRECT_URI,
    };

    return cca.acquireTokenByCode(tokenRequest);
};
