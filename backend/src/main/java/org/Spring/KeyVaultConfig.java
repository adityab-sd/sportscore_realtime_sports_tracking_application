package org.Spring;

import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.SecretClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

@Configuration
public class KeyVaultConfig {

    @Value("${azure.keyvault.uri}")
    private String keyVaultUri;

    @Bean
    public SecretClient secretClient() {
        return new SecretClientBuilder()
                .vaultUrl(keyVaultUri)
                .credential(new DefaultAzureCredentialBuilder().build())
                .buildClient();
    }

    @Bean
    public MapPropertySource keyVaultPropertySource(SecretClient secretClient,
                                                     ConfigurableEnvironment environment) {
        Map<String, Object> secrets = Map.of(
                "eventhub.connection-string", secretClient.getSecret("eventhub-connection-string").getValue(),
                "eventhub.name",              secretClient.getSecret("eventhub-name").getValue(),
                "apisports.key",              secretClient.getSecret("apisports-key").getValue()
        );

        MapPropertySource propertySource = new MapPropertySource("keyVaultSecrets", secrets);
        environment.getPropertySources().addFirst(propertySource);
        return propertySource;
    }
}
