package org.sportscore.config;

import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.SecretClientBuilder;

public class KeyVaultSecretProvider {

    private static SecretClient client;

    private static SecretClient getClient() {
        if (client == null) {
            String uri = System.getenv("KEYVAULT_URI");
            client = new SecretClientBuilder()
                    .vaultUrl(uri)
                    .credential(new DefaultAzureCredentialBuilder().build())
                    .buildClient();
        }
        return client;
    }

    public static String getSecret(String secretName) {
        return getClient().getSecret(secretName).getValue();
    }
}
