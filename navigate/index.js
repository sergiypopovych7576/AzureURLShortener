const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");
const { createClient } = require("redis");

module.exports = async function (context, req) {
    const credential = new DefaultAzureCredential();

    const url = process.env["AzureKeyVaultHostName"];
    const client = new SecretClient(url, credential);

    const redisURL = await client.getSecret('redis-hostname');
    const redisKey = await client.getSecret('redis-key');

    var cacheConnection = createClient({
        url: `rediss://${redisURL.value}:6380`,
        password: redisKey.value,
    });
    await cacheConnection.connect();

    const hash = context.bindingData.hash;
    let originalURL = await cacheConnection.get(hash);
    if(!originalURL) {
        context.res = {
            status: 404
        };
        return;
    }

    context.res = {
        status: 302,
        headers: {
            location: originalURL
        }
    };
}