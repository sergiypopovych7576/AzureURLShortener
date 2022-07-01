const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");
const { createClient } = require("redis");

const hash = require('hash.js');
const appInsights = require('applicationinsights');

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

    const redisKeyTTL = await client.getSecret('redis-ttl');
    const hashedURL = hash.sha256().update(req.body.url).digest('hex').slice(0, 6);
    await cacheConnection.set(hashedURL, req.body.url, {
        EX: +redisKeyTTL.value
    });

    const appInsightConnectionString = await client.getSecret('insight-connection');
    appInsights.setup(appInsightConnectionString.value).start();
    const metricClient = appInsights.defaultClient;
    metricClient.trackMetric({
        name: 'URLLength',
        value: req.body.url.length
    });

    const serviceUrl = req.url.split('process')[0];
    const finalUrl = `${serviceUrl}${hashedURL}`;
    context.res = {
        body: {
            url: finalUrl
        }
    };
}