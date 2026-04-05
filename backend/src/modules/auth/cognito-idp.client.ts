import {
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { getCognitoConfig } from "./cognito.helper.js";

let cognitoClient: CognitoIdentityProviderClient | undefined;

export function getCognitoIdentityProviderClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    const { region } = getCognitoConfig();

    cognitoClient = new CognitoIdentityProviderClient({
      region,
    });
  }

  return cognitoClient;
}

export { AdminInitiateAuthCommand, InitiateAuthCommand, SignUpCommand };
