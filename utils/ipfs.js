// Public Pinata gateway is unreliable/deprecated for anonymous access.
// Use a public IPFS HTTP gateway that still resolves pinned CIDs.
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

function getIpfsGatewayBase() {
    const fromEnv = process.env.IPFS_GATEWAY
    if (fromEnv) {
        return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
    }
    return DEFAULT_IPFS_GATEWAY
}

function ipfsUrl(cid) {
    if (!cid) return ''
    return `${getIpfsGatewayBase()}${cid}`
}

module.exports = {
    ipfsUrl,
    getIpfsGatewayBase
}
