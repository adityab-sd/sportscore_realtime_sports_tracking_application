package org.Spring;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "azure.keyvault.uri")
public class KeyVaultConfig {

    @Value("${azure.keyvault.uri}")
    private String keyVaultUri;

    // @Bean
    // public SecretClient secretClient() {
    //     return new SecretClientBuilder()
    //             .vaultUrl(keyVaultUri)
    //             .credential(new DefaultAzureCredentialBuilder().build())
    //             .buildClient();
    // }

    // @Bean
    // public MapPropertySource keyVaultPropertySource(SecretClient secretClient,
    //                                                  ConfigurableEnvironment environment) {
    //     Map<String, Object> secrets = Map.of(
    //             "eventhub.connection-string", secretClient.getSecret("eventhub-connection-string").getValue(),
    //             "eventhub.name",              secretClient.getSecret("eventhub-name").getValue(),
    //             "apisports.key",              secretClient.getSecret("apisports-key").getValue()
    //     );

    //     MapPropertySource propertySource = new MapPropertySource("keyVaultSecrets", secrets);
    //     environment.getPropertySources().addFirst(propertySource);
    //     return propertySource;
    // }
}
}
