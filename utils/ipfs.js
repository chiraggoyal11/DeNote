const axios = require('axios');

const DEFAULT_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://w3s.link/ipfs/'
];

function normalizeGateway(base) {
    if (!base) return null;
    return base.endsWith('/') ? base : `${base}/`;
}

function getIpfsGateways() {
    const fromEnv = normalizeGateway(process.env.IPFS_GATEWAY);
    const list = [];
    if (fromEnv) list.push(fromEnv);
    for (const g of DEFAULT_GATEWAYS) {
        if (!list.includes(g)) list.push(g);
    }
    return list;
}

function getIpfsGatewayBase() {
    return getIpfsGateways()[0];
}

function ipfsUrl(cid) {
    if (!cid) return '';
    return `${getIpfsGatewayBase()}${cid}`;
}

function ipfsCandidateUrls(cid) {
    if (!cid) return [];
    return getIpfsGateways().map((base) => `${base}${cid}`);
}

async function fetchIpfsContent(cid, options = {}) {
    const { responseType = 'stream', timeout = 45000 } = options;
    const errors = [];

    for (const url of ipfsCandidateUrls(cid)) {
        try {
            const response = await axios.get(url, {
                responseType,
                timeout,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });
            return { response, url };
        } catch (err) {
            errors.push(`${url}: ${err.message}`);
        }
    }

    const error = new Error(`All IPFS gateways failed for ${cid}`);
    error.details = errors;
    throw error;
}

module.exports = {
    ipfsUrl,
    ipfsCandidateUrls,
    getIpfsGatewayBase,
    getIpfsGateways,
    fetchIpfsContent
};
