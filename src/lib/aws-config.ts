// AWS Amplify Configuration
// These values will come from your backend deployment (template.yaml outputs)

const appUrl = import.meta.env.VITE_APP_URL ||
  (window.location.hostname === 'localhost'
    ? window.location.origin
    : 'https://www.claritx.ai');
export const awsConfig: Record<string, any> = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "us-east-1_PLACEHOLDER",
            userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
            loginWith: {
                email: true,
                oauth: {
                    domain: import.meta.env.VITE_COGNITO_DOMAIN || "",
                    scopes: ['openid', 'email', 'profile'],
                    redirectSignIn: [`${appUrl}/auth`],
                    redirectSignOut: [`${appUrl}/auth`],
                    responseType: 'code' as const,
                },
            },
        }
    }
};
